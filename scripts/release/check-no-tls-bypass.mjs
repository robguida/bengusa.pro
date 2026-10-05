// Fails if any tracked file turns off TLS certificate checks (threat model
// item M12): Node's environment switch for it, the TLS option that stops
// rejecting unauthorized certificates, or npm's strict-ssl turned off.
// Runs in CI and in the local gate. The patterns are built from pieces so
// this file (and any comment about them) does not match itself.
//
//   node scripts/release/check-no-tls-bypass.mjs
import { ROOT, capture } from './lib.mjs';

const S = '[[:space:]]*';
const patterns = [
    ['NODE', 'TLS', 'REJECT', 'UNAUTHORIZED'].join('_'),
    `${'reject'}${'Unauthorized'}["']?${S}:${S}false`,
    `${'strict'}[-_]?${'ssl'}["']?${S}[=:]${S}false`,
];

const r = capture('git', ['grep', '-n', '-I', '-i', '-E', ...patterns.flatMap((p) => ['-e', p])], { cwd: ROOT });
if (r.code === 1) {
    console.log('TLS check: no file turns off certificate checks.');
    process.exit(0);
}
if (r.code === 0) {
    console.error('TLS check FAILED: these lines turn off certificate checks. Remove them:');
    console.error(r.stdout.trimEnd().split('\n').map((l) => `  ${l}`).join('\n'));
    process.exit(1);
}
console.error(`TLS check could not run (git grep exit ${r.code}): ${r.stderr.trim()}`);
process.exit(2);
