// Local release gate: the same checks as CI (.github/workflows/ci.yml), in
// the same order, on this laptop. Change both together. It is the gate of
// record until the first green CI run exists on GitHub. The only
// differences, all on purpose (the CI file lists the same ones):
//   - it first copies the commit into a clean temp folder (CI checks out);
//   - browsers install without --with-deps (that needs root; the laptop has them);
//   - Windows only: it renames the misnamed export files before the tests;
//   - it passes --forbid-only and --no-fund itself (CI gets them from env);
//   - it packages on every pass; CI packages and uploads on push runs only.
// The audits and the signature check run right after npm ci, before any
// package code runs.
//
//   node scripts/release/gate.mjs [--commit <rev>] [--keep] [--no-package]
//   (or double-click scripts/release/gate.cmd)
//
// It tests a COMMIT, never unsaved work: it clones the repo into a temp
// folder, checks out the commit (default HEAD) and runs every step there, so
// it never touches this folder or a running dev server. It stops at the first
// red step. On a pass it packages the build as a release bundle (version.txt
// + MANIFEST.sha256) under the deploy home, ready for preview.
//
// Windows: Next's Windows export bug misnames some page-data files. The gate
// renames them (scripts/release/fix-windows-export.mjs) and runs the browser
// tests with E2E_STRICT_404=1, so the renamed build is what is tested and
// packaged. CI builds on Linux and needs no rename.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IS_WIN, MIN_NODE, ROOT, bundlesDir, capture, git, run, runNpm, versionAtLeast } from './lib.mjs';

process.env.NEXT_TELEMETRY_DISABLED = '1';

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const say = (msg) => console.log(`\n=== ${msg}`);
const started = Date.now();

// --- Preflight --------------------------------------------------------------
if (!versionAtLeast(process.version, MIN_NODE)) {
    console.error(`Node ${process.version} is too old: this project needs Node >= ${MIN_NODE}.`);
    process.exit(1);
}
const pinned = fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
if (process.version.replace(/^v/, '') !== pinned) {
    console.warn(`WARNING: this is Node ${process.version}; CI uses ${pinned} (.nvmrc). The gate still runs.`);
}

const rev = arg('commit', 'HEAD');
let commit;
try {
    commit = git(['rev-parse', '--verify', `${rev}^{commit}`]);
} catch (err) {
    console.error(err.message);
    process.exit(2);
}
const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
const tree = git(['rev-parse', `${commit}^{tree}`]);
const local = git(['status', '--porcelain']);
if (local) {
    console.warn('NOTE: this folder has changes that are not committed. They are NOT tested:');
    console.warn(local.split('\n').map((l) => `  ${l}`).join('\n'));
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bengusa-gate-'));
console.log(`Gate for commit ${commit} (${branch}), tree ${tree}`);
console.log(`Node ${process.version} on ${process.platform}. Work folder: ${work}`);

// --- Steps (same order as CI) ---------------------------------------------
const steps = [
    ['Copy the commit into a clean folder', async () => {
        const c = await run('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', ROOT, work], { cwd: os.tmpdir() });
        if (c.code !== 0) return c;
        return run('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', commit], { cwd: work });
    }],
    ['No TLS-check bypass in the code or templates', () => run(process.execPath, ['scripts/release/check-no-tls-bypass.mjs'], { cwd: work })],
    ['Install (npm ci, lockfile only, no install scripts)', () => runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: work })],
    // The audits run no package code, so they go before anything that does.
    ['Audit production deps (fails on high or critical)', () => runNpm(['audit', '--omit=dev', '--audit-level=high'], { cwd: work })],
    ['Audit all deps (fails on critical)', () => runNpm(['audit', '--audit-level=critical'], { cwd: work })],
    ['Verify registry signatures', () => runNpm(['audit', 'signatures'], { cwd: work })],
    // CI adds --with-deps (Linux system packages, needs root); the laptop has them.
    ['Install test browsers', () => run(process.execPath, ['node_modules/@playwright/test/cli.js', 'install', 'chromium', 'webkit'], { cwd: work })],
    ['Lint', () => runNpm(['run', 'lint'], { cwd: work })],
    ['Settings test (before the build; it deletes out/)', () => runNpm(['run', 'test:env'], { cwd: work })],
    ['Build (guarded wrapper)', () => runNpm(['run', 'build'], { cwd: work })],
    ...(IS_WIN ? [['Fix the Windows export file names', () => run(process.execPath, ['scripts/release/fix-windows-export.mjs'], { cwd: work })]] : []),
    ['Browser and build-output tests (strict: no 404s)', () => runNpm(['run', 'test:e2e', '--', '--forbid-only'], { cwd: work, env: { E2E_STRICT_404: '1' } })],
    ['Deploy script self-test (no server)', () => run(process.execPath, ['scripts/deploy/deploy.mjs', 'selftest'], { cwd: work })],
    ...(flag('no-package') ? [] : [['Package the build (version.txt + MANIFEST.sha256)', () => run(process.execPath,
        ['scripts/release/package.mjs', '--out', bundlesDir(), '--source', IS_WIN ? 'gate-win32-renamed' : `gate-${process.platform}`], { cwd: work })]]),
];

const results = [];
let failed = null;
for (const [name, fn] of steps) {
    say(name);
    const t = Date.now();
    const r = await fn();
    const secs = ((Date.now() - t) / 1000).toFixed(0);
    results.push(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${name} (${secs}s)`);
    if (r.code !== 0) {
        failed = name;
        if (r.error) console.error(r.error.message);
        break;
    }
}

// --- Result -------------------------------------------------------------------
console.log('\n=== Gate summary');
for (const line of results) console.log(`  ${line}`);
const mins = ((Date.now() - started) / 60000).toFixed(1);
if (failed) {
    console.log(`\nGATE FAILED at "${failed}" for commit ${commit} after ${mins} min.`);
    console.log(`The work folder is kept for a look: ${work}`);
    if (fs.existsSync(path.join(work, 'playwright-report'))) console.log(`Test report: ${path.join(work, 'playwright-report', 'index.html')}`);
    process.exit(1);
}
console.log(`\nGATE PASSED for commit ${commit} (tree ${tree}) on ${new Date().toISOString()}, ${mins} min, Node ${process.version}, ${process.platform}.`);
if (flag('keep')) console.log(`Work folder kept: ${work}`);
else fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
