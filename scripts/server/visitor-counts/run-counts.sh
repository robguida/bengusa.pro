#!/usr/bin/env bash
# bengusa.pro visitor counts (BUWEB-125). Runs on the box as root, from the systemd timer.
# Reads the 14-day corp access log, writes ONE totals report with no IP addresses.
# Nothing else is kept: no database, no temp copy of the log, no container logs.
set -euo pipefail
umask 077

LOGDIR=/home/ec2-user/bengusa-corp-site/logs
OUTDIR=/home/ec2-user/bengusa-corp-site/counts      # outside www/ (the only web root), owner-only
OUTFILE="$OUTDIR/totals-latest.html"
# Install step 3 pins this to the image digest (docker inspect --format '{{index .RepoDigests 0}}').
IMAGE="${GOACCESS_IMAGE:-allinurl/goaccess:1.9.4}"

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 2; }
install -d -m 0700 -o ec2-user -g ec2-user "$OUTDIR"
WORK="$OUTDIR/.working.$$"
trap 'rm -f "$WORK"' EXIT

# Oldest first. zcat -f reads plain and .gz files alike. Nothing is copied to disk.
files=()
for n in $(seq 14 -1 1); do
  for f in "$LOGDIR/access.log.$n" "$LOGDIR/access.log.$n.gz"; do
    if [ -f "$f" ]; then files+=("$f"); fi
  done
done
if [ -f "$LOGDIR/access.log" ]; then files+=("$LOGDIR/access.log"); fi
if [ "${#files[@]}" -eq 0 ]; then echo "no log files yet"; exit 0; fi

# nginx log_format bengusa_corp:
#   $remote_addr [$time_local] "$request_method $bengusa_path" $status $body_bytes_sent "$bengusa_ua"
# Panels dropped: HOSTS (the visitor-IP list), geo, ASN, referrers (the log has none), remote user,
# cache status, vhosts. stderr goes to /dev/null on purpose: a parse error can quote a log line,
# and that line holds an IP.
set +e
zcat -f "${files[@]}" | docker run --rm -i \
  --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --log-driver none --user 65534:65534 \
  "$IMAGE" \
  --log-format='%h [%d:%t %^] "%m %U" %s %b "%u"' \
  --date-format='%d/%b/%Y' --time-format='%T' \
  --anonymize-ip --ignore-crawlers --no-query-string \
  --ignore-panel=HOSTS --ignore-panel=GEO_LOCATION --ignore-panel=ASN \
  --ignore-panel=REFERRERS --ignore-panel=REFERRING_SITES --ignore-panel=KEYPHRASES \
  --ignore-panel=REMOTE_USER --ignore-panel=CACHE_STATUS --ignore-panel=VIRTUAL_HOSTS \
  --ignore-panel=TLS_TYPE \
  -o html - > "$WORK" 2>/dev/null
rc=$?
set -e
if [ "$rc" -ne 0 ] || [ ! -s "$WORK" ]; then echo "goaccess failed rc=$rc (no report written)"; exit 1; fi

# Belt and braces: refuse to keep a report that holds anything shaped like an IP address.
if grep -Eq '([0-9]{1,3}\.){3}[0-9]{1,3}|([0-9A-Fa-f]{1,4}:){3,}[0-9A-Fa-f]{0,4}' "$WORK"; then
  echo "IP-shaped text found in report; report discarded"; exit 1
fi

chown ec2-user:ec2-user "$WORK"
chmod 0600 "$WORK"
mv -f "$WORK" "$OUTFILE"
# Only the totals file may live here.
find "$OUTDIR" -mindepth 1 ! -name 'totals-latest.html' -delete
echo "ok: $(wc -c < "$OUTFILE") byte report from ${#files[@]} log file(s)"
