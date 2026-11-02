// Deploys a release bundle from THIS LAPTOP: to preview first, then to live.
// CI never deploys: the server's SSH port is open to one home IP only.
//
//   node scripts/deploy/deploy.mjs list
//   node scripts/deploy/deploy.mjs fetch-ci <run-id>
//   node scripts/deploy/deploy.mjs deploy   --target preview|live --manifest <sha256> [--dry-run] [--no-smoke] [--offline]
//     --no-smoke is for preview only (live's smoke check is what rolls it back);
//     --offline works only with --dry-run (a real deploy always asks GitHub first).
//   node scripts/deploy/deploy.mjs status   --target preview|live
//   node scripts/deploy/deploy.mjs rollback --target preview|live [--dry-run]
//   node scripts/deploy/deploy.mjs selftest
//   Any command that names a target also takes --config <file>
//   (default: <deploy home>/targets/<target>.env; template: scripts/deploy/target.env.example).
//   A live deploy also reads the preview settings (--preview-config <file>).
//
// Where bundles come from (built ONCE, then the same bytes go to preview and live):
//   - CI (preferred): every green push run uploads one, built on Linux.
//     `fetch-ci <run-id>` downloads it and checks it.
//   - The local gate (scripts/release/gate.mjs): on Windows it renames the
//     misnamed page-data files and tests that renamed build strictly.
// A bundle is named by the sha256 of its MANIFEST.sha256 ("the manifest").
//
// What deploy refuses:
//   - uncommitted changes to tracked files in this folder;
//   - a bundle whose files do not match its manifest, or not the approved manifest;
//   - a commit that is not on GitHub (only origin's branches count, after a
//     fetch that prunes deleted ones); for live, a commit that is not on main;
//   - live, unless preview is serving exactly that manifest right now;
//   - settings that live inside the repo, a key file inside the repo, a host key
//     that does not match the pinned one (no trust-on-first-use, no prompts).
// The server half (remote.sh) checks the manifest again before it switches.
// Live runs origin/main's copy of remote.sh, never this checkout's.
// A live deploy whose smoke check fails is rolled back on the spot.
// No npm, no build and no secrets on the server: it only receives files.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    BUILD_ID_RE, HASH_RE, IS_WIN, MANIFEST, PUBLIC, REPO_ROOT, ROOT, bundlesDir, capture, deployHome, git, isInside,
    isMain, listBundles, readBundleInfo, sha256, sha256File, verifyBundle, writeBundle,
} from '../release/lib.mjs';

process.env.NEXT_TELEMETRY_DISABLED = '1';

const REMOTE_SH_PATH = 'scripts/deploy/remote.sh';
const GIT_USR_BIN = 'C:\\Program Files\\Git\\usr\\bin';
const TAR = IS_WIN && fs.existsSync('C:\\Windows\\System32\\tar.exe') ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
const DEFAULT_SSH = IS_WIN && fs.existsSync(path.join(GIT_USR_BIN, 'ssh.exe')) ? path.join(GIT_USR_BIN, 'ssh.exe') : 'ssh';
const GH = process.env.GH_PATH || (IS_WIN && fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh');
const TOKEN_RE = /^[A-Za-z0-9._/:@=+-]+$/; // every word sent to the server matches this
const ROOT_RE = /^\/srv\/sites\/[a-z0-9][a-z0-9.-]*$/;

class Refused extends Error {}

// The server script that gets sent. Live = main only, and that covers the code
// that runs on the live box: a live command sends origin/main's copy (as of the
// last fetch). Preview and the self-test send this checkout's committed copy.
const checkoutScript = () => fs.readFileSync(path.join(ROOT, ...REMOTE_SH_PATH.split('/')), 'utf8').replace(/\r/g, '');
function serverScript(target) {
    if (target !== 'live') return { text: checkoutScript(), from: `this checkout's ${REMOTE_SH_PATH}` };
    const r = capture('git', ['show', `origin/main:src/${REMOTE_SH_PATH}`], { cwd: ROOT });
    if (r.code !== 0 || !r.stdout.trim()) {
        throw new Refused(`live sends the server script from origin/main, and origin/main has no src/${REMOTE_SH_PATH} yet (${r.stderr.trim() || 'empty'})`);
    }
    return { text: r.stdout.replace(/\r/g, ''), from: `origin/main:src/${REMOTE_SH_PATH}` };
}

// ---------------------------------------------------------------------------
// Arguments and settings
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const opts = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) { opts._.push(a); continue; }
        const key = a.slice(2);
        if (['dry-run', 'no-smoke', 'offline'].includes(key)) opts[key] = true;
        else if (['target', 'manifest', 'config', 'preview-config'].includes(key)) opts[key] = argv[++i];
        else throw new Refused(`unknown option: ${a}`);
    }
    return opts;
}

const fwd = (p) => p.replace(/\\/g, '/');

export function hostKeyFingerprint(line) {
    const blob = Buffer.from(line.split(' ')[1] || '', 'base64');
    return `SHA256:${crypto.createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')}`;
}

// Reads <deploy home>/targets/<target>.env. Collects every problem.
export function loadTarget(target, configPath) {
    const file = path.resolve(configPath || path.join(deployHome(), 'targets', `${target}.env`));
    const problems = [];
    if (!fs.existsSync(file)) {
        return { file, problems: [`no settings for "${target}" at ${file} (the server ticket creates them; template: scripts/deploy/target.env.example)`] };
    }
    if (isInside(file, REPO_ROOT)) problems.push(`settings file ${file} is inside the repo; keep it outside`);
    const known = ['DEPLOY_TARGET', 'DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_KEY', 'DEPLOY_HOSTKEY', 'DEPLOY_SITE_ROOT', 'DEPLOY_URL', 'DEPLOY_SSH'];
    const v = {};
    for (const [i, raw] of fs.readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (!m) { problems.push(`line ${i + 1} is not KEY=value`); continue; }
        if (!known.includes(m[1])) { problems.push(`line ${i + 1}: unknown setting ${m[1]}`); continue; }
        v[m[1]] = m[2].trim();
    }
    const need = (k, ok, why) => { if (!v[k]) problems.push(`${k} is missing`); else if (!ok(v[k])) problems.push(`${k} ${why}`); };
    need('DEPLOY_TARGET', (x) => x === target, `must be "${target}" (this file is for another target)`);
    need('DEPLOY_HOST', (x) => /^[A-Za-z0-9.-]{1,253}$/.test(x), 'must be a host name or IPv4 address');
    need('DEPLOY_USER', (x) => /^[a-z_][a-z0-9_-]{0,31}$/.test(x), 'must be a plain Unix user name');
    need('DEPLOY_KEY', (x) => path.isAbsolute(x) && !isInside(x, REPO_ROOT), 'must be an absolute path outside the repo');
    need('DEPLOY_HOSTKEY', (x) => /^ssh-ed25519 [A-Za-z0-9+/]{68}$/.test(x), 'must be the server\'s "ssh-ed25519 AAAA..." host key');
    need('DEPLOY_SITE_ROOT', (x) => ROOT_RE.test(x), 'must be /srv/sites/<name>');
    need('DEPLOY_URL', (x) => /^https:\/\/[a-z0-9.-]+$/.test(x), 'must be https://<host> with no path');
    if (v.DEPLOY_URL) {
        const isPreviewHost = new URL(v.DEPLOY_URL).hostname.startsWith('preview.');
        if (target === 'preview' && !isPreviewHost) problems.push('DEPLOY_URL for preview must start with https://preview.');
        if (target === 'live' && isPreviewHost) problems.push('DEPLOY_URL for live must not be the preview address');
    }
    return {
        file, problems,
        cfg: {
            target, host: v.DEPLOY_HOST, user: v.DEPLOY_USER, key: v.DEPLOY_KEY, hostKey: v.DEPLOY_HOSTKEY,
            siteRoot: v.DEPLOY_SITE_ROOT, url: v.DEPLOY_URL, ssh: v.DEPLOY_SSH || DEFAULT_SSH,
        },
    };
}

// ---------------------------------------------------------------------------
// Transports: SSH for real targets, a local sh for the self-test. Both run
// the same command lines, so the self-test exercises what SSH would run.
// ---------------------------------------------------------------------------
function sshTransport(cfg, tmpDir, scriptText) {
    const knownHosts = path.join(tmpDir, `known_hosts-${cfg.target}`);
    const emptyConfig = path.join(tmpDir, 'ssh_config-empty');
    fs.writeFileSync(knownHosts, `${cfg.host} ${cfg.hostKey}\n`);
    fs.writeFileSync(emptyConfig, '');
    const base = [
        '-F', fwd(emptyConfig), '-i', fwd(cfg.key),
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', `UserKnownHostsFile=${fwd(knownHosts)}`, '-o', `GlobalKnownHostsFile=${fwd(knownHosts)}`,
        '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4', '-o', 'LogLevel=ERROR',
        `${cfg.user}@${cfg.host}`,
    ];
    return {
        label: `${cfg.user}@${cfg.host}:${cfg.siteRoot}`,
        root: cfg.siteRoot,
        scriptText,
        script: (args) => [cfg.ssh, [...base, ['sh', '-s', '--', ...args].join(' ')]],
        receive: (line) => [cfg.ssh, [...base, line]],
    };
}

// --selftest lets remote.sh accept a temp folder that ends in /srv/sites/<name>.
function localTransport(sh, root, fakeLinks, scriptText) {
    return {
        label: `local ${root}`,
        root,
        scriptText,
        script: (args) => [sh, ['-s', '--', '--selftest', ...(fakeLinks ? ['--fake-links'] : []), ...args]],
        receive: (line) => [sh, ['-c', line]],
    };
}

function checkTokens(words) {
    for (const w of words) if (!TOKEN_RE.test(w)) throw new Refused(`refusing to send an unsafe word to the server: ${JSON.stringify(w)}`);
}

function callScript(t, args) {
    checkTokens(args);
    const [cmd, argv] = t.script(args);
    const r = spawnSync(cmd, argv, { input: t.scriptText, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    return { code: r.status ?? 127, stdout: (r.stdout || '').trim(), stderr: ((r.stderr || '') + (r.error ? r.error.message : '')).trim() };
}

function receiveLine(root, id) {
    checkTokens([root, id]);
    const d = `${root}/releases/${id}.partial`;
    return `PATH=/usr/local/bin:/usr/bin:/bin; umask 022; set -e; test -d ${root}/releases; test ! -e ${root}/releases/${id}; ` +
        `rm -rf ${d}; mkdir ${d}; tar -xf - -C ${d} --no-same-owner`;
}

// Streams MANIFEST.sha256 + public/ as a tar into the receiver.
function upload(t, bundleDir, id) {
    const [cmd, argv] = t.receive(receiveLine(t.root, id));
    return new Promise((resolve) => {
        let err = '';
        const tar = spawn(TAR, ['-c', '-f', '-', '--format=ustar', '-C', bundleDir, MANIFEST, PUBLIC], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        const rx = spawn(cmd, argv, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
        tar.stderr.on('data', (c) => { err += c; });
        rx.stderr.on('data', (c) => { err += c; });
        tar.stdout.pipe(rx.stdin);
        rx.stdin.on('error', () => {}); // receiver gone: its exit code says why
        let left = 2;
        const codes = {};
        const done = () => { if (--left === 0) resolve({ code: codes.tar || codes.rx, stderr: err.trim() }); };
        tar.on('error', (e) => { err += e.message; codes.tar = 127; });
        rx.on('error', (e) => { err += e.message; codes.rx = 127; });
        tar.on('close', (c) => { codes.tar = codes.tar || c || 0; done(); });
        rx.on('close', (c) => { codes.rx = codes.rx || c || 0; done(); });
    });
}

// ---------------------------------------------------------------------------
// The deploy itself (used by `deploy` and by the self-test).
// bundle = { dir, buildId, manifestHash }.
// ---------------------------------------------------------------------------
export async function deployBundle({ bundle, t, target, previewT = null, smokeUrl = null, log = console.log }) {
    if (target === 'live') {
        if (!previewT) throw new Refused('live needs the preview settings to check what preview serves');
        const p = callScript(previewT, ['manifest', previewT.root]);
        if (p.code !== 0) throw new Refused(`could not read what preview serves: ${p.stderr}`);
        if (p.stdout !== bundle.manifestHash) {
            throw new Refused(`REFUSED: preview serves manifest ${p.stdout}, not ${bundle.manifestHash}. Deploy it to preview and test it there first.`);
        }
        log('  preview serves this exact manifest: OK');
    }
    const c = callScript(t, ['check', t.root, bundle.buildId, bundle.manifestHash]);
    if (c.code !== 0) throw new Refused(`server check failed: ${c.stderr}`);
    if (c.stdout === 'conflict') throw new Refused(`REFUSED: the server has a different release named ${bundle.buildId}`);
    if (c.stdout === 'absent') {
        const u = await upload(t, bundle.dir, bundle.buildId);
        if (u.code !== 0) throw new Refused(`upload failed: ${u.stderr}`);
        log('  uploaded');
    } else {
        log('  already on the server (same manifest): not uploaded again');
    }
    const a = callScript(t, ['activate', t.root, bundle.buildId, bundle.manifestHash]);
    if (a.code !== 0) throw new Refused(a.stderr || 'activate failed');
    log(`  ${a.stdout}`);
    if (smokeUrl) {
        const s = callScript(t, ['smoke', t.root, smokeUrl, target === 'preview' ? '401' : '200']);
        if (s.code !== 0) {
            if (target === 'live') {
                const r = callScript(t, ['rollback', t.root]);
                throw new Refused(`SMOKE FAILED (${s.stderr}). Rolled back: ${r.code === 0 ? r.stdout : `ROLLBACK FAILED TOO: ${r.stderr}`}`);
            }
            throw new Refused(`SMOKE FAILED on preview: ${s.stderr}`);
        }
        log(`  ${s.stdout}`);
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function findBundle(manifestHash) {
    return listBundles().find((b) => b.manifestHash === manifestHash) || null;
}

function cmdList() {
    const all = listBundles();
    if (!all.length) { console.log(`No bundles yet in ${bundlesDir()}. Run the gate, or fetch-ci <run-id>.`); return 0; }
    console.log(`Bundles in ${bundlesDir()} (newest first):`);
    for (const b of all) console.log(`  ${b.buildId}  ${b.info.source || '?'}  manifest ${b.manifestHash}`);
    return 0;
}

function repoSlug() {
    const url = git(['remote', 'get-url', 'origin']);
    const m = url.match(/github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
    if (!m) throw new Refused(`origin is not a GitHub repo: ${url}`);
    return m[1];
}

function cmdFetchCi(runId) {
    if (!/^[0-9]+$/.test(runId || '')) throw new Refused('usage: fetch-ci <run-id> (the number in the run\'s address)');
    const slug = repoSlug();
    const v = capture(GH, ['run', 'view', runId, '-R', slug, '--json', 'headSha,headBranch,event,status,conclusion,workflowName,url']);
    if (v.code !== 0) throw new Refused(`gh could not read run ${runId}: ${v.stderr.trim()}`);
    const run = JSON.parse(v.stdout);
    const problems = [];
    if (run.workflowName !== 'CI') problems.push(`run ${runId} is workflow "${run.workflowName}", not CI`);
    if (run.event !== 'push') problems.push(`run ${runId} was a ${run.event} run; only push runs build the branch's exact commit`);
    if (run.status !== 'completed' || run.conclusion !== 'success') problems.push(`run ${runId} is ${run.status}/${run.conclusion}, not completed/success`);
    if (problems.length) throw new Refused(`REFUSED:\n  - ${problems.join('\n  - ')}`);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bengusa-fetch-'));
    try {
        const d = capture(GH, ['run', 'download', runId, '-R', slug, '-n', `site-${run.headSha}`, '-D', tmp]);
        if (d.code !== 0) throw new Refused(`download failed: ${d.stderr.trim()}`);
        const ids = fs.readdirSync(tmp).filter((n) => BUILD_ID_RE.test(n));
        if (ids.length !== 1) throw new Refused(`expected one bundle in the artifact, found ${ids.length}`);
        const src = path.join(tmp, ids[0]);
        const check = verifyBundle(src);
        if (!check.ok) throw new Refused(`the CI bundle does not verify:\n  - ${check.problems.join('\n  - ')}`);
        if (check.version.commit !== run.headSha) throw new Refused(`bundle commit ${check.version.commit} is not the run's commit ${run.headSha}`);
        if (readBundleInfo(src).source !== 'ci') throw new Refused('the bundle does not say it was built by CI');
        const dest = path.join(bundlesDir(), ids[0]);
        if (fs.existsSync(dest)) {
            if (sha256File(path.join(dest, MANIFEST)) !== check.manifestHash) throw new Refused(`a different bundle named ${ids[0]} is already here`);
            console.log(`Already fetched: ${ids[0]}  manifest ${check.manifestHash}`);
            return 0;
        }
        fs.mkdirSync(bundlesDir(), { recursive: true });
        fs.cpSync(src, dest, { recursive: true, errorOnExist: true, force: false });
        console.log(`Fetched CI bundle ${ids[0]} from ${run.url}`);
        console.log(`  commit ${run.headSha} (${run.headBranch}), ${check.files} files`);
        console.log(`  manifest ${check.manifestHash}`);
        console.log(`Next: node scripts/deploy/deploy.mjs deploy --target preview --manifest ${check.manifestHash}`);
        return 0;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function provenance(commit, target, offline, dryRun) {
    const problems = [];
    const notes = [];
    if (!offline) {
        // --prune drops the refs of branches deleted on GitHub, so they can't vouch for a commit.
        const f = capture('git', ['fetch', '--quiet', '--prune', 'origin'], { cwd: ROOT });
        if (f.code !== 0) (dryRun ? notes : problems).push(`could not fetch from GitHub: ${f.stderr.trim()}`);
    } else {
        notes.push('--offline (dry run): GitHub was not asked; the branch checks use the last fetch');
    }
    // Only origin (GitHub) counts. Refs from any other remote (the old bitbucket one) do not.
    const on = capture('git', ['for-each-ref', '--format=%(refname)', '--contains', commit, 'refs/remotes/origin'], { cwd: ROOT });
    if (on.code !== 0 || !on.stdout.trim()) problems.push(`commit ${commit} is not on GitHub (push it, through the normal gate, first)`);
    if (target === 'live' && capture('git', ['merge-base', '--is-ancestor', commit, 'origin/main'], { cwd: ROOT }).code !== 0) {
        problems.push(`live deploys need a commit that is on main; ${commit} is not`);
    }
    return { problems, notes };
}

async function cmdDeploy(opts) {
    const { target, manifest } = opts;
    if (!['preview', 'live'].includes(target)) throw new Refused('--target must be preview or live');
    if (!HASH_RE.test(manifest || '')) throw new Refused('--manifest must be the 64-character sha256 of the approved MANIFEST.sha256');
    if (target === 'live' && opts['no-smoke']) throw new Refused('REFUSED: --no-smoke is for preview only. Live\'s smoke check is what rolls a bad deploy back.');
    if (opts.offline && !opts['dry-run']) throw new Refused('REFUSED: --offline works only with --dry-run. A real deploy always asks GitHub first.');
    const refusals = [];
    const notes = [];

    const tracked = git(['status', '--porcelain', '--untracked-files=no']);
    if (tracked) refusals.push(`this folder has uncommitted changes to tracked files; commit or undo them first:\n${tracked}`);

    const bundle = findBundle(manifest);
    let check = null;
    if (!bundle) refusals.push(`no local bundle has manifest ${manifest} (run the gate, or fetch-ci <run-id>; "list" shows what is here)`);
    else {
        check = verifyBundle(bundle.dir, manifest);
        refusals.push(...check.problems.map((p) => `bundle: ${p}`));
        if (check.version.commit) {
            const p = provenance(check.version.commit, target, opts.offline, opts['dry-run']);
            refusals.push(...p.problems);
            notes.push(...p.notes);
        }
    }

    const t = loadTarget(target, opts.config);
    const pv = target === 'live' ? loadTarget('preview', opts['preview-config']) : null;
    const missingSettings = [t, pv].filter(Boolean).filter((x) => !x.cfg);
    for (const x of [t, pv].filter(Boolean)) {
        (opts['dry-run'] && !x.cfg ? notes : refusals).push(...x.problems.map((p) => `settings (${x.file}): ${p}`));
        if (x.cfg && !opts['dry-run'] && x.cfg.key && !fs.existsSync(x.cfg.key)) refusals.push(`key file not found: ${x.cfg.key} (is the drive that holds it mounted?)`);
    }
    if (pv?.cfg && t.cfg && (pv.cfg.siteRoot === t.cfg.siteRoot || pv.cfg.url === t.cfg.url)) refusals.push('preview and live settings point at the same site');
    let server = null;
    try { server = serverScript(target); } catch (err) { refusals.push(err.message); }

    console.log(`Deploy ${opts['dry-run'] ? 'DRY RUN' : ''} -> ${target}`);
    if (bundle) {
        console.log(`  bundle   ${bundle.buildId} (${bundle.info.source || '?'}), ${check.files} files, commit ${check.version.commit}`);
        console.log(`  manifest ${manifest}`);
    }
    if (server) console.log(`  script   ${server.from} (sha256 ${sha256(Buffer.from(server.text)).slice(0, 16)}…)`);
    if (t.cfg) {
        console.log(`  server   ${t.cfg.user}@${t.cfg.host}  ${t.cfg.siteRoot}  ${t.cfg.url}`);
        console.log(`  host key ${hostKeyFingerprint(t.cfg.hostKey)} (pinned; must match the server's ssh-keygen -lf)`);
    }
    for (const n of notes) console.log(`  note: ${n}`);
    if (refusals.length) {
        console.error('\nREFUSED:');
        for (const r of refusals) console.error(`  - ${r}`);
        return 1;
    }

    if (opts['dry-run']) {
        const root = t.cfg?.siteRoot || '/srv/sites/<site>';
        const id = bundle.buildId;
        console.log('\nWould run (nothing sent):');
        if (target === 'live') console.log(`  1. on preview: sh -s -- manifest ${pv.cfg?.siteRoot || '<preview root>'}   (must print ${manifest})`);
        console.log(`  2. sh -s -- check ${root} ${id} ${manifest}`);
        console.log(`  3. ${TAR} -c -f - --format=ustar -C ${bundle.dir} ${MANIFEST} ${PUBLIC}  | ssh ... '${receiveLine(root, id)}'`);
        console.log(`  4. sh -s -- activate ${root} ${id} ${manifest}`);
        if (!opts['no-smoke']) console.log(`  5. sh -s -- smoke ${root} ${t.cfg?.url || '<url>'} ${target === 'preview' ? '401' : '200'}${target === 'live' ? '   (rollback if it fails)' : ''}`);
        if (missingSettings.length) console.log('\nDRY RUN OK, except: the target settings do not exist yet (expected until the server ticket).');
        else console.log('\nDRY RUN OK: every local check passed.');
        return 0;
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bengusa-deploy-'));
    try {
        // A live deploy sends main's script to both servers (preview only answers "manifest").
        await deployBundle({
            bundle, target,
            t: sshTransport(t.cfg, tmp, server.text),
            previewT: pv ? sshTransport(pv.cfg, tmp, server.text) : null,
            smokeUrl: opts['no-smoke'] ? null : t.cfg.url,
        });
        console.log(`\nDEPLOYED ${bundle.buildId} to ${target} (manifest ${manifest}).`);
        return 0;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

async function cmdServer(command, opts) {
    if (!['preview', 'live'].includes(opts.target)) throw new Refused('--target must be preview or live');
    const t = loadTarget(opts.target, opts.config);
    if (t.problems.length) throw new Refused(`settings (${t.file}):\n  - ${t.problems.join('\n  - ')}`);
    const server = serverScript(opts.target);
    if (opts['dry-run']) { console.log(`Would run on ${t.cfg.user}@${t.cfg.host}: sh -s -- ${command} ${t.cfg.siteRoot}  (script: ${server.from})`); return 0; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bengusa-deploy-'));
    try {
        const r = callScript(sshTransport(t.cfg, tmp, server.text), [command, t.cfg.siteRoot]);
        if (r.stdout) console.log(r.stdout);
        if (r.code !== 0) { console.error(r.stderr); return 1; }
        return 0;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------
// Self-test: the server half against temp folders on this machine, through
// the same command lines SSH would carry. Linux (CI) uses real symlinks;
// Windows uses --fake-links (no symlinks without Developer Mode).
// ---------------------------------------------------------------------------
async function cmdSelftest() {
    const sh = IS_WIN ? path.join(GIT_USR_BIN, 'sh.exe') : '/bin/sh';
    if (!fs.existsSync(sh)) throw new Refused(`no sh at ${sh}`);
    const fake = IS_WIN;
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bengusa-deploy-selftest-'));
    const shPath = (p) => (IS_WIN ? `/${p[0].toLowerCase()}${fwd(p.slice(2))}` : p);
    const results = [];
    const quiet = () => {};
    const pass = (name) => results.push(['PASS', name]);
    const fail = (name, why) => results.push(['FAIL', name, why]);
    const ok = async (name, fn) => { try { await fn(); pass(name); } catch (e) { fail(name, e.message); } };
    const refuses = async (name, fn, re) => {
        try { await fn(); fail(name, 'expected a refusal, got success'); } catch (e) {
            if (re && !re.test(e.message)) fail(name, `refused for another reason: ${e.message}`); else pass(name);
        }
    };
    const expect = (cond, why) => { if (!cond) throw new Error(why); };

    try {
        const roots = {};
        for (const [name, site] of [['preview', 'preview.selftest.invalid'], ['live', 'selftest.invalid']]) {
            roots[name] = path.join(base, 'srv', 'sites', site);
            fs.mkdirSync(path.join(roots[name], 'releases'), { recursive: true });
        }
        const SH = checkoutScript();
        const P = localTransport(sh, shPath(roots.preview), fake, SH);
        const L = localTransport(sh, shPath(roots.live), fake, SH);
        const status = (t) => Object.fromEntries(callScript(t, ['status', t.root]).stdout.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=')));
        // remote.sh run through a sh command line, with no client-side word check,
        // so the server's own checks are what get tested.
        const rawScript = (line) => {
            const r = spawnSync(sh, ['-c', line], { input: SH, encoding: 'utf8', windowsHide: true });
            return { code: r.status ?? 127, out: `${(r.stdout || '').trim()} ${(r.stderr || '').trim()}`.trim() };
        };

        const site = path.join(base, 'site');
        fs.mkdirSync(path.join(site, 'about'), { recursive: true });
        fs.mkdirSync(path.join(site, '_next', 'static'), { recursive: true });
        fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><title>home</title>\n');
        fs.writeFileSync(path.join(site, 'about', 'index.html'), '<!doctype html><title>about</title>\n');
        fs.writeFileSync(path.join(site, '_next', 'static', 'app.js'), 'console.log(1)\n');
        const make = (i, change) => {
            const src = path.join(base, `src-${i}`);
            fs.cpSync(site, src, { recursive: true });
            fs.writeFileSync(path.join(src, 'index.html'), `<!doctype html><title>home ${i}</title>\n`);
            if (change) change(src);
            return writeBundle({ srcDir: src, parentDir: path.join(base, 'bundles'), commit: String(i).repeat(40), source: 'selftest', buildId: `20260101T00000${i}Z-${String(i).repeat(7)}` });
        };
        const A = make(1);
        const B = make(2);

        await ok('deploy A to preview', () => deployBundle({ bundle: A, t: P, target: 'preview', log: quiet }));
        await ok('preview now serves A', () => expect(status(P).current === A.buildId && status(P).manifest === A.manifestHash, JSON.stringify(status(P))));
        await ok('A is read-only on the server', () => {
            const f = path.join(roots.preview, 'releases', A.buildId, 'public', 'index.html');
            expect((fs.statSync(f).mode & 0o222) === 0, `mode ${(fs.statSync(f).mode & 0o777).toString(8)}`);
        });
        await refuses('live refuses a bundle preview is not serving', () => deployBundle({ bundle: B, t: L, previewT: P, target: 'live', log: quiet }), /preview serves manifest/);
        await ok('deploy B to preview', () => deployBundle({ bundle: B, t: P, target: 'preview', log: quiet }));
        await ok('deploy B to live (preview serves it)', () => deployBundle({ bundle: B, t: L, previewT: P, target: 'live', log: quiet }));
        await ok('live now serves B', () => expect(status(L).current === B.buildId, JSON.stringify(status(L))));
        await ok('re-deploying B to preview skips the upload', async () => {
            const lines = [];
            await deployBundle({ bundle: B, t: P, target: 'preview', log: (l) => lines.push(l) });
            expect(lines.some((l) => l.includes('already on the server')), lines.join(' | '));
        });

        const C = make(3);
        fs.chmodSync(path.join(C.dir, PUBLIC, 'index.html'), 0o644);
        fs.appendFileSync(path.join(C.dir, PUBLIC, 'index.html'), 'tampered\n');
        await ok('local check catches a changed file', () => expect(!verifyBundle(C.dir, C.manifestHash).ok, 'verify passed'));
        await refuses('server refuses a changed file and keeps B live', async () => {
            const u = await upload(P, C.dir, C.buildId);
            expect(u.code === 0, `upload failed: ${u.stderr}`);
            const a = callScript(P, ['activate', P.root, C.buildId, C.manifestHash]);
            expect(status(P).current === B.buildId, 'current moved');
            expect(!fs.existsSync(path.join(roots.preview, 'releases', `${C.buildId}.partial`)), 'bad upload left behind');
            if (a.code !== 0) throw new Refused(a.stderr);
        }, /did not verify/);

        const D = make(4);
        fs.writeFileSync(path.join(D.dir, PUBLIC, 'extra.html'), 'not in the manifest\n');
        await ok('local check catches an extra file', () => expect(verifyBundle(D.dir).problems.some((p) => p.includes('not in the manifest')), 'not caught'));
        await refuses('server refuses an extra file', async () => {
            await upload(P, D.dir, D.buildId);
            const a = callScript(P, ['activate', P.root, D.buildId, D.manifestHash]);
            if (a.code !== 0) throw new Refused(a.stderr);
        }, /did not verify/);
        await refuses('server refuses a manifest that is not the approved one', async () => {
            await upload(P, A.dir, '20260101T000009Z-9999999');
            const a = callScript(P, ['activate', P.root, '20260101T000009Z-9999999', B.manifestHash]);
            if (a.code !== 0) throw new Refused(a.stderr);
        }, /not the approved/);
        await refuses('a release name already used by another bundle is refused', () => deployBundle({ bundle: { ...B, manifestHash: A.manifestHash }, t: P, target: 'preview', log: quiet }), /different release named/);
        await refuses('a bad build id is refused before anything is sent', () => deployBundle({ bundle: { ...A, buildId: 'x; rm -rf /' }, t: P, target: 'preview', log: quiet }), /unsafe word/);
        await refuses('the server refuses a bad build id', async () => {
            const a = callScript(P, ['activate', P.root, 'not-an-id', A.manifestHash]);
            if (a.code !== 0) throw new Refused(a.stderr);
        }, /bad build id/);
        await ok('the server refuses a build id with a second line in it', () => {
            const flags = `--selftest${fake ? ' --fake-links' : ''}`;
            const r = rawScript(`id=$(printf '%s\\n%s' ${A.buildId} x); exec /bin/sh -s -- ${flags} check ${P.root} "$id" ${A.manifestHash}`);
            expect(r.code !== 0 && /bad build id/.test(r.out), `exit ${r.code}: ${r.out}`);
        });
        await ok('outside the self-test the server needs /srv/sites/<name>', () => {
            const away = rawScript(`exec /bin/sh -s -- status ${P.root}`);
            expect(away.code !== 0 && /must be \/srv\/sites\/<name>/.test(away.out), `temp root: exit ${away.code}: ${away.out}`);
            const exact = rawScript('exec /bin/sh -s -- status /srv/sites/selftest.invalid');
            expect(exact.code !== 0 && /no \/srv\/sites\/selftest\.invalid\/releases/.test(exact.out), `exact root: exit ${exact.code}: ${exact.out}`);
        });
        await refuses('the server refuses a manifest path with an empty part', async () => {
            const dir = path.join(base, 'empty-part');
            fs.mkdirSync(path.join(dir, PUBLIC), { recursive: true });
            fs.writeFileSync(path.join(dir, PUBLIC, 'index.html'), 'x\n');
            const m = `${sha256(Buffer.from('x\n'))}  ${PUBLIC}//index.html\n`;
            fs.writeFileSync(path.join(dir, MANIFEST), m);
            const id = '20260101T000010Z-abcdef0';
            const u = await upload(P, dir, id);
            expect(u.code === 0, `upload failed: ${u.stderr}`);
            const a = callScript(P, ['activate', P.root, id, sha256(Buffer.from(m))]);
            if (a.code !== 0) throw new Refused(a.stderr);
        }, /empty part/);

        await ok('rollback on preview goes back to A', () => {
            const r = callScript(P, ['rollback', P.root]);
            expect(r.code === 0 && status(P).current === A.buildId, `${r.stderr} ${JSON.stringify(status(P))}`);
        });
        await ok('a second rollback returns to B', () => {
            const r = callScript(P, ['rollback', P.root]);
            expect(r.code === 0 && status(P).current === B.buildId, `${r.stderr} ${JSON.stringify(status(P))}`);
        });

        const more = [5, 6, 7, 8].map((i) => make(i));
        await ok('four more deploys prune the oldest releases', async () => {
            for (const b of more) await deployBundle({ bundle: b, t: P, target: 'preview', log: quiet });
            const left = fs.readdirSync(path.join(roots.preview, 'releases')).filter((n) => BUILD_ID_RE.test(n)).sort();
            expect(left.length === 5, `left: ${left.join(', ')}`);
            expect(!left.includes(A.buildId) && left.includes(more[3].buildId), `left: ${left.join(', ')}`);
            expect(!fs.readdirSync(path.join(roots.preview, 'releases')).some((n) => n.endsWith('.partial')), 'a .partial was left');
        });
        await ok('the deploy log has one line per switch', () => {
            const n = fs.readFileSync(path.join(roots.preview, 'deploys.log'), 'utf8').trim().split('\n').length;
            expect(n === 9, `${n} lines`);
        });

        // The live safety net. Preview serves the newest bundle; live gets it with a
        // smoke check that cannot pass (nothing serves selftest.invalid on this box's
        // port 443), so live must roll straight back to B and log it.
        const top = more[3];
        await refuses('a failed live smoke check rolls live back to the previous release', () => deployBundle({
            bundle: top, t: L, previewT: P, target: 'live', smokeUrl: 'https://selftest.invalid', log: quiet,
        }), new RegExp(`SMOKE FAILED[\\s\\S]*Rolled back: rolled back to ${B.buildId}`));
        await ok('live serves B again and its log records the rollback', () => {
            expect(status(L).current === B.buildId, JSON.stringify(status(L)));
            const last = fs.readFileSync(path.join(roots.live, 'deploys.log'), 'utf8').trim().split('\n').pop().split('\t');
            expect(last[1] === 'rollback' && last[2] === B.buildId && last[3] === B.manifestHash && last[4] === top.buildId, last.join(' | '));
        });
    } finally {
        spawnSync(sh, ['-c', `chmod -R u+w ${shPath(base)}`], { windowsHide: true });
        fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
    }

    for (const [s, name, why] of results) console.log(`  ${s}  ${name}${why ? `: ${why}` : ''}`);
    const failed = results.filter((r) => r[0] === 'FAIL').length;
    console.log(`\nDeploy self-test (${fake ? 'Windows, file pointer instead of symlinks' : 'real symlinks'}): ${results.length - failed} passed, ${failed} failed.`);
    return failed ? 1 : 0;
}

// ---------------------------------------------------------------------------
async function main() {
    const [command, ...rest] = process.argv.slice(2);
    const opts = parseArgs(rest);
    switch (command) {
        case 'list': return cmdList();
        case 'fetch-ci': return cmdFetchCi(opts._[0]);
        case 'deploy': return cmdDeploy(opts);
        case 'status': return cmdServer('status', opts);
        case 'rollback': return cmdServer('rollback', opts);
        case 'selftest': return cmdSelftest();
        default:
            console.error('Usage: node scripts/deploy/deploy.mjs list | fetch-ci <run-id> | deploy --target preview|live --manifest <sha256> [--dry-run] [--no-smoke (preview only)] [--offline (dry run only)] | status --target <t> | rollback --target <t> | selftest');
            return 2;
    }
}

if (isMain(import.meta.url)) {
    try {
        process.exitCode = await main();
    } catch (err) {
        console.error(err instanceof Refused ? err.message : err.stack);
        process.exitCode = 1;
    }
}
