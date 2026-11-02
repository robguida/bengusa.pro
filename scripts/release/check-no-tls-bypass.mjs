// Fails if any tracked file turns off a certificate or host-key check (threat
// model item M12, widened in the 104c review). Each rule below names, in
// words, the switch it catches: Node's TLS switches, npm's strict SSL, git's
// SSL verification, curl's short and long "skip the certificate" flags, the
// ssh options that undo the pinned host key, Playwright's and Chromium's
// "ignore HTTPS errors" settings, and Playwright's browser download host.
// Runs in CI and in the local gate. The patterns are built from pieces so
// this file (and any comment about them) does not match itself. Keep the
// rule names in plain words for the same reason.
//
//   node scripts/release/check-no-tls-bypass.mjs
import { REPO_ROOT, capture } from './lib.mjs';

const S = '[[:space:]]*';
const SEP = `["']?${S}[=:[:space:]]${S}["']?`; // "=", ":" or a space, quotes allowed
const END = '([^[:alnum:]_-]|$)';
const OFF = `(false|0|no|off)${END}`;
const w = (...parts) => parts.join('');

const rules = [
    ['Node: the TLS environment switch', ['NODE', 'TLS', 'REJECT', 'UNAUTHORIZED'].join('_')],
    ['Node: the TLS option that accepts any certificate', `${w('reject', 'Unauthorized')}["']?${S}[:=]${S}(false|0)${END}`],
    ['npm: strict SSL turned off', `${w('strict')}[-_]?${w('ssl')}${SEP}${OFF}`],
    ['git: the SSL no-verify environment switch', ['GIT', 'SSL', 'NO', 'VERIFY'].join('_')],
    ['git: SSL verification turned off', `${w('ssl')}[-_]?${w('verify')}${SEP}${OFF}`],
    ['curl: the short skip-the-certificate flag', `${w('cu', 'rl')}[^|;&]*[[:space:]]-[[:alpha:]]*k[[:alpha:]]*([[:space:]]|$)`],
    ['any tool: the long insecure flag', `--${w('in', 'secure')}${END}`],
    ['ssh: host key checking turned off', `${w('StrictHost', 'KeyChecking')}${SEP}(no|off|accept-new)${END}`],
    ['ssh: known-hosts file thrown away', `(User|Global)${w('KnownHosts', 'File')}${SEP}(/dev/null|nul)${END}`],
    ['Playwright: HTTPS errors ignored (option)', `${w('ignore', 'HTTPSErrors')}["']?${S}[:=]${S}(true|1)${END}`],
    ['Playwright: HTTPS errors ignored (command flag)', `--${w('ignore-', 'https-errors')}`],
    ['Chromium: certificate errors ignored', w('ignore-', 'certificate-errors')],
    ['Playwright: browser download host swapped', `${w('PLAYWRIGHT')}_([A-Z]+_)?${w('DOWNLOAD', '_HOST')}`],
];

const hits = [];
for (const [name, pattern] of rules) {
    const r = capture('git', ['grep', '-n', '-I', '-i', '-E', '-e', pattern], { cwd: REPO_ROOT });
    if (r.code === 1) continue;
    if (r.code !== 0) {
        console.error(`TLS check could not run rule "${name}" (git grep exit ${r.code}): ${r.stderr.trim()}`);
        process.exit(2);
    }
    for (const line of r.stdout.trimEnd().split('\n')) hits.push(`[${name}] ${line}`);
}
if (hits.length) {
    console.error('TLS check FAILED: these lines turn off certificate or host-key checks. Remove them:');
    console.error(hits.map((l) => `  ${l}`).join('\n'));
    process.exit(1);
}
console.log(`TLS check: no file turns off certificate or host-key checks (${rules.length} rules).`);
