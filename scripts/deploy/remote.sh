# Server half of scripts/deploy/deploy.mjs. It is never copied to the server
# and never run by hand: deploy.mjs sends it over SSH on stdin and runs
#     sh -s -- <command> <site-root> [args]
# as the site's deploy user (no sudo). POSIX sh only: CI also runs it under dash.
#
# Layout on the server (the server ticket, 105b, creates <root>/releases):
#   <root>/releases/<build-id>/MANIFEST.sha256
#   <root>/releases/<build-id>/public/       the site files, made read-only
#   <root>/current -> releases/<build-id>    Apache DocumentRoot = <root>/current/public
#   <root>/deploys.log                       one line per activate or rollback
#
# Commands:
#   check    <root> <id> <hash>   prints absent | present | conflict
#   activate <root> <id> <hash>   verifies the upload against the approved manifest
#                                 hash, then switches current to it in one step
#   manifest <root>               prints the sha256 of the live MANIFEST.sha256 (or none)
#   status   <root>               current, previous, last deploys
#   rollback <root>               switches current back to the previous release
#   smoke    <root> <url> <code>  fetches <url>/version.txt through this box's own
#                                 web server; 200 = must be the current build,
#                                 401 = the preview lock is on
# Self-test only: a first argument of --fake-links keeps the "current" pointer
# in a file, because Windows can't make real symlinks without Developer Mode.

set -eu
umask 022
PATH=/usr/local/bin:/usr/bin:/bin
LC_ALL=C
export PATH LC_ALL

fake=0
if [ "${1:-}" = "--fake-links" ]; then fake=1; shift; fi

die() { printf 'remote: %s\n' "$*" >&2; exit 1; }

cmd=${1:-}
root=${2:-}
a3=${3:-}
a4=${4:-}

case "$root" in /*) ;; *) die "site root must be an absolute path" ;; esac
case "$root" in *[!A-Za-z0-9._/-]*|*/../*|*/..|*/./*|*/.) die "bad site root: $root" ;; esac
rel="$root/releases"
[ -d "$rel" ] || die "no $rel (the server is not set up for deploys yet)"
log_file="$root/deploys.log"

valid_id() { printf '%s\n' "$1" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$'; }
valid_hash() { printf '%s\n' "$1" | grep -Eq '^[0-9a-f]{64}$'; }

current_id() {
    if [ "$fake" = 1 ]; then t=$(cat "$root/current.fake" 2>/dev/null || true)
    else t=$(readlink "$root/current" 2>/dev/null || true); fi
    case "$t" in
        releases/*) printf '%s\n' "${t#releases/}" ;;
        "$rel"/*) printf '%s\n' "${t#"$rel"/}" ;;
        *) printf '\n' ;;
    esac
}

# Atomic switch: a new link is made beside "current", then renamed over it.
point_current() {
    if [ "$fake" = 1 ]; then
        printf 'releases/%s\n' "$1" > "$root/current.fake.new"
        mv -f "$root/current.fake.new" "$root/current.fake"
        return
    fi
    ln -sfn "releases/$1" "$root/.current.new"
    mv -Tf "$root/.current.new" "$root/current"
}

# The last activated release that is not the current one.
previous_id() {
    [ -f "$log_file" ] || { printf '\n'; return; }
    awk -F '\t' -v cur="$(current_id)" '$3 != cur && $3 != "" { p = $3 } END { print p }' "$log_file"
}

log_line() {
    printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$4" >> "$log_file"
}

# Every check uses an explicit "|| die", so it also holds inside a subshell.
verify() {
    d=$1
    want=$2
    [ -f "$d/MANIFEST.sha256" ] && [ -d "$d/public" ] || die "release is incomplete: $d"
    extra=$(ls -A "$d" | grep -Ev '^(MANIFEST\.sha256|public)$' || true)
    [ -z "$extra" ] || die "unexpected entries in the release: $extra"
    got=$(sha256sum "$d/MANIFEST.sha256" | cut -d ' ' -f 1)
    [ "$got" = "$want" ] || die "manifest is $got, not the approved $want"
    bad=$(grep -Evc '^[0-9a-f]{64}  public/[^[:cntrl:]\\]+$' "$d/MANIFEST.sha256" || true)
    [ "$bad" = 0 ] || die "manifest has $bad malformed line(s)"
    if grep -Eq '/\.\.?(/|$)' "$d/MANIFEST.sha256"; then die "manifest names a . or .. path"; fi
    dup=$(cut -c 67- "$d/MANIFEST.sha256" | sort | uniq -d | head -n 3)
    [ -z "$dup" ] || die "manifest lists a file twice: $dup"
    odd=$(find "$d/public" ! -type f ! -type d | head -n 3)
    [ -z "$odd" ] || die "release holds links or special files: $odd"
    (cd "$d" && sha256sum --quiet --strict -c MANIFEST.sha256) >&2 || die "files do not match the manifest"
    listed=$(wc -l < "$d/MANIFEST.sha256" | tr -d ' ')
    actual=$(find "$d/public" -type f | wc -l | tr -d ' ')
    [ "$listed" = "$actual" ] || die "manifest lists $listed files but the release has $actual"
}

# Releases are read-only once verified.
lock_release() {
    find "$1/public" -type f -exec chmod 0444 {} +
    find "$1/public" -type d -exec chmod 0555 {} +
    chmod 0444 "$1/MANIFEST.sha256"
}

# Keeps the 5 newest releases plus current and previous; removes failed uploads.
# One release that can't be removed does not stop the rest.
prune() {
    cur=$(current_id)
    prev=$(previous_id)
    for p in "$rel"/*.partial; do
        [ -d "$p" ] || continue
        rm -rf "$p" || printf 'remote: could not remove %s\n' "$p" >&2
    done
    n=0
    for d in $(ls -1 "$rel" | grep -E '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$' | sort -r); do
        n=$((n + 1))
        [ "$n" -le 5 ] && continue
        case "$d" in "$cur"|"$prev") continue ;; esac
        { chmod -R u+w "$rel/$d" && rm -rf "${rel:?}/$d"; } || printf 'remote: could not prune %s\n' "$d" >&2
    done
}

do_check() {
    valid_id "$a3" || die "bad build id: $a3"
    valid_hash "$a4" || die "bad manifest hash"
    if [ -d "$rel/$a3" ]; then
        got=$(sha256sum "$rel/$a3/MANIFEST.sha256" 2>/dev/null | cut -d ' ' -f 1 || true)
        if [ "$got" = "$a4" ]; then echo present; else echo conflict; fi
    else
        echo absent
    fi
}

do_activate() {
    id=$a3
    want=$a4
    valid_id "$id" || die "bad build id: $id"
    valid_hash "$want" || die "bad manifest hash"
    if [ -d "$rel/$id.partial" ]; then
        [ ! -e "$rel/$id" ] || die "release $id already exists"
        ( verify "$rel/$id.partial" "$want" ) || { rm -rf "$rel/$id.partial"; die "REFUSED: the upload did not verify, so it was deleted. Nothing changed."; }
        mv "$rel/$id.partial" "$rel/$id"
        lock_release "$rel/$id"
    elif [ -d "$rel/$id" ]; then
        ( verify "$rel/$id" "$want" ) || die "REFUSED: release $id on the server does not verify. Nothing changed."
    else
        die "release $id was not uploaded"
    fi
    before=$(current_id)
    point_current "$id"
    log_line activate "$id" "$want" "$before"
    prune
    printf 'activated %s (before: %s)\n' "$id" "${before:-none}"
}

do_manifest() {
    cur=$(current_id)
    if [ -n "$cur" ] && [ -f "$rel/$cur/MANIFEST.sha256" ]; then
        sha256sum "$rel/$cur/MANIFEST.sha256" | cut -d ' ' -f 1
    else
        echo none
    fi
}

do_status() {
    echo "current=$(current_id)"
    echo "previous=$(previous_id)"
    echo "manifest=$(do_manifest)"
    echo "releases=$(ls -1 "$rel" | grep -Ec '^[0-9]{8}T[0-9]{6}Z-' || true)"
    if [ -f "$log_file" ]; then tail -n 5 "$log_file" | sed 's/^/log: /'; fi
}

do_rollback() {
    cur=$(current_id)
    prev=$(previous_id)
    [ -n "$prev" ] || die "no previous release to roll back to"
    [ -d "$rel/$prev" ] || die "previous release $prev is gone"
    hash=$(sha256sum "$rel/$prev/MANIFEST.sha256" | cut -d ' ' -f 1)
    logged=$(awk -F '\t' -v id="$prev" '$3 == id { h = $4 } END { print h }' "$log_file")
    [ "$hash" = "$logged" ] || die "REFUSED: release $prev no longer matches the manifest it was deployed with"
    ( verify "$rel/$prev" "$hash" ) || die "REFUSED: release $prev does not verify. Nothing changed."
    point_current "$prev"
    log_line rollback "$prev" "$hash" "$cur"
    printf 'rolled back to %s (was %s)\n' "$prev" "${cur:-none}"
}

do_smoke() {
    url=$a3
    want=$a4
    case "$url" in https://*) ;; *) die "smoke URL must be https" ;; esac
    host=${url#https://}
    host=${host%%/*}
    case "$host" in ''|*[!a-z0-9.-]*) die "bad host in smoke URL" ;; esac
    tmp=$(mktemp)
    code=$(curl -sS --max-time 15 --resolve "$host:443:127.0.0.1" -o "$tmp" -w '%{http_code}' "https://$host/version.txt") \
        || { rm -f "$tmp"; die "could not reach https://$host through this box's web server"; }
    case "$want" in
        200)
            [ "$code" = 200 ] || { rm -f "$tmp"; die "version.txt returned $code, not 200"; }
            cur=$(current_id)
            [ "$(cat "$tmp")" = "$(cat "$rel/$cur/public/version.txt")" ] || { rm -f "$tmp"; die "the site is not serving the new build"; }
            ;;
        401)
            [ "$code" = 401 ] || { rm -f "$tmp"; die "preview returned $code without a password (expected 401: is the lock off?)"; }
            ;;
        *) rm -f "$tmp"; die "bad expected code: $want" ;;
    esac
    rm -f "$tmp"
    echo "smoke ok: https://$host/version.txt -> $code"
}

case "$cmd" in
    check) do_check ;;
    activate) do_activate ;;
    manifest) do_manifest ;;
    status) do_status ;;
    rollback) do_rollback ;;
    smoke) do_smoke ;;
    *) die "unknown command: $cmd" ;;
esac
