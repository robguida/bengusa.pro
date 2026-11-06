# Visitor counts for bengusa.pro (BUWEB-125)

Status: **prepared only. Nothing here has been run on the box.** Server steps wait for Rob's direct go (the deploy go includes the server login). This folder lives in `scripts/`, so it never ships with the site.

## What it does
Once a day a small job reads the server's own 14-day visitor log, counts it with **GoAccess** (free, open source), and leaves **one** totals report on the box. Rob reads it over SSH or copies it to his PC. It is never served on the web.

The report has, per day: visits, "unique visitors", page views, top pages, 404s, status codes, browser and OS share, busy hours. It has **no IP addresses, no host names, no per-visitor rows.**

## Why GoAccess in a throw-away container (not installed on the box)
- Amazon Linux 2023 does not ship GoAccess, and a source build needs a compiler on the box. Docker is already there, so the tool runs as `docker run --rm` and leaves nothing installed on the host.
- The container has no network, a read-only disk, no capabilities, a 256 MB memory cap, and no container log. The log is piped in over stdin. Nothing is written inside it.
- Other free tools (AWStats, Webalizer) build their own per-visitor database by design. GoAccess in pipe mode keeps none.

## Size and side effects
- One Docker image: roughly 20 to 40 MB (confirm with `docker images` at install). The box had about 35 GB free (Sammy's look, 10-22).
- Adds to the box: that image, one script, two systemd unit files, one 0700 folder holding one report file (a few hundred KB at most).
- Writes logs of its own? No file log. `--log-driver none` means Docker keeps no container log. systemd writes its usual "started / finished" lines to the journal, plus one line from the script (status and byte count, no IPs). The script sends GoAccess's error output to /dev/null on purpose, because a parse error can quote a log line.
- Touches pay or the co-founder's compose file? No. It only reads `~/bengusa-corp-site/logs/`. No nginx, compose, container or site-file change.

## Privacy limits (the live Privacy page must stay true)
| Limit | How |
|---|---|
| Totals only, no IPs kept | `--ignore-panel=HOSTS` (and geo, ASN), `--anonymize-ip`, and the script refuses to keep any report containing an address that appears in the input logs (or any IPv6-shaped text) |
| No GoAccess database | no `--persist`, `--restore` or `--db-path`; read-only container |
| Nothing added to the site | no JS, pixel, cookie, nginx or site-file change; no request to an outside address (container has `--network none`) |
| Report never public | `~/bengusa-corp-site/counts/` is not under `www/`, not mounted into nginx, mode 0700, file 0600 |
| Working files cleaned | no temp copy of the log is ever made; the one working file is removed on exit; the folder is swept to just `totals-latest.html` each run |
| No IP kept past the 14-day log | the report is rebuilt from the log each day; nothing else holds IPs |

Read this before relying on the numbers:
- **"Unique visitors" is only a rough guide.** The log's address column is mostly the AWS edge's address, not the visitor's (the Lightsail distribution sits in front; Cora I1 in the box plan). Many real people share one edge address. Visits and page views are good; unique visitors will read low. Fixing that means logging the forwarded address, which changes what the log keeps and so the Privacy page. Not done here.
- `--anonymize-ip` blanks the last part of each address, which lowers the unique count a little more.
- The Privacy page says nothing about keeping day totals longer than 14 days. This design keeps none: the report is rebuilt from a 14-day log, so it never shows more than 14 days. A long history of totals would hold no personal data, but it is Rob's and the legal reviewer's call first.
- The spec's "nothing in front of the server" line (docs/requirements.md, 18.f) does not match the distribution that is in front. That is an existing question for the legal reviewer, not caused by this counter.

## Install (Otto, after Rob's go; SSH as ec2-user, pinned host keys as in the 11-02 deploy)
1. Check: `docker ps --format '{{.Names}}'` shows `bengusa-prod-edge-1`; `ls -l ~/bengusa-corp-site/logs/` shows `access.log`; `systemctl is-active docker`.
2. Copy the files up: `scp run-counts.sh bengusa-counts.service bengusa-counts.timer ec2-user@<box>:~/`
3. Pull and pin the image (the one outbound fetch, made by the box from Docker Hub, not by the site):
   `sudo docker pull allinurl/goaccess:1.9.4` (use the newest 1.9.x tag if that one is gone), then
   `sudo docker inspect --format '{{index .RepoDigests 0}}' allinurl/goaccess:1.9.4`
   and put that `allinurl/goaccess@sha256:...` value on the `IMAGE=` line of `~/run-counts.sh`.
4. Install:
   ```
   sudo install -o root -g root -m 0750 ~/run-counts.sh /usr/local/sbin/bengusa-run-counts
   sudo install -o root -g root -m 0644 ~/bengusa-counts.service ~/bengusa-counts.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   rm ~/run-counts.sh ~/bengusa-counts.service ~/bengusa-counts.timer
   ```
5. Test once by hand:
   `sudo systemctl start bengusa-counts.service; sudo journalctl -u bengusa-counts.service -n 5 --no-pager`
   Then `ls -la ~/bengusa-corp-site/counts/` must show only `totals-latest.html`, `-rw-------`, owner ec2-user.
   Prove no IPs: run the service once and read the journal: `sudo systemctl start bengusa-counts.service; sudo journalctl -u bengusa-counts.service -n 20 --no-pager`. It must show `ok:` and must not show `visitor address found`.
   If the script says "visitor address found", treat it as real: do not loosen the check. (Browser and OS version numbers no longer trip it, BUWEB-127.)
6. Prove nothing is left behind: `sudo docker ps -a` shows no goaccess container.
7. Switch on: `sudo systemctl enable --now bengusa-counts.timer; systemctl list-timers bengusa-counts.timer`
8. Site unchanged: `curl -sI https://bengusa.pro/` as before. Nothing in nginx, compose or the site folder was touched.

## Rob reads the report
`scp -i <key> ec2-user@<box>:bengusa-corp-site/counts/totals-latest.html .` then open it on his PC. It is one file and needs no internet.

## Undo (reverses everything; touches nothing else)
```
sudo systemctl disable --now bengusa-counts.timer
sudo rm -f /etc/systemd/system/bengusa-counts.timer /etc/systemd/system/bengusa-counts.service /usr/local/sbin/bengusa-run-counts
sudo systemctl daemon-reload
rm -rf ~/bengusa-corp-site/counts
sudo docker rmi allinurl/goaccess:1.9.4        # or the digest form
```
The log folder, logrotate, nginx and compose are never changed by this, so nothing there needs undoing.

## Not confirmed (no server access by design; no Docker on the PC)
- Docker Hub tag and image size were not fetched. Confirm at install step 3.
- That every `--ignore-panel=` name (ASN, TLS_TYPE especially) exists in the pinned version. A wrong name makes GoAccess exit with an error and no report is written (it fails closed). Remove that one flag if so.
- **No run has happened anywhere.** Step 5 is the first test.
- Box state since 11-02: log file present, logrotate active, worker uid 101, Docker unchanged.
