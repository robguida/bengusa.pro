// BUWEB-130: copy the box's daily visit report to this PC as analytics/reports/bengusa-YYYY-MM-DD.html.
// Run: node scripts/analytics/pull-report.mjs   (W: must be mounted for the key). Node built-ins only.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'W:/keys/RobGuida/LightsailDefaultKey-us-east-1.pem';
const KNOWN_HOSTS = 'C:/Users/robgu/Downloads/scratch/bengusa-kh/known_hosts';
const REMOTE = 'ec2-user@23.23.95.201:bengusa-corp-site/counts/totals-latest.html';
const top = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

if (!existsSync(KEY)) { console.log('needs W: mounted'); process.exit(0); }
const dir = path.join(top, 'analytics', 'reports');
mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `bengusa-${new Date().toISOString().slice(0, 10)}.html`);
const r = spawnSync('scp', ['-i', KEY, '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${KNOWN_HOSTS}`, REMOTE, dest], { stdio: 'inherit' });
if (r.status !== 0) { console.error('pull failed (scp exit ' + r.status + ')'); process.exit(1); }
console.log('saved ' + dest);
