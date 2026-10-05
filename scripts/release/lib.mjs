// Shared helpers for the release gate, the packager and the deploy script.
// Ops tooling only: nothing here ships to the browser. Node built-ins only.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const IS_WIN = process.platform === 'win32';
export const MIN_NODE = '20.9.0';

export const MANIFEST = 'MANIFEST.sha256';
export const PUBLIC = 'public';
export const BUNDLE_INFO = 'bundle.json';
export const BUILD_ID_RE = /^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$/;
export const HASH_RE = /^[0-9a-f]{64}$/;

// True when this file is the script Node was started with.
export function isMain(metaUrl) {
    return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

// Bundles and target settings live OUTSIDE the repo and are never committed.
// Windows: %LOCALAPPDATA%\bengusa-deploy. Linux: ~/.local/state/bengusa-deploy.
export function deployHome() {
    if (process.env.BENGUSA_DEPLOY_HOME) return path.resolve(process.env.BENGUSA_DEPLOY_HOME);
    if (IS_WIN && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'bengusa-deploy');
    const state = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    return path.join(state, 'bengusa-deploy');
}
export const bundlesDir = () => path.join(deployHome(), 'bundles');

export function isInside(child, parent) {
    const rel = path.relative(path.resolve(parent), path.resolve(child));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function versionAtLeast(version, min) {
    const a = String(version).replace(/^v/, '').split('.').map(Number);
    const b = String(min).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return true;
}

// ---------------------------------------------------------------------------
// Running commands. No shell anywhere: arguments go to the program as they are.
// ---------------------------------------------------------------------------

// npm without a shell: run npm-cli.js with this same Node. (Windows can't
// spawn npm.cmd without a shell, and a shell would re-parse the arguments.)
export function npmCli() {
    const dir = path.dirname(process.execPath);
    const candidates = [
        path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows layout
        path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Linux layout
        process.env.npm_execpath,
    ].filter(Boolean);
    const found = candidates.find((p) => path.basename(p) === 'npm-cli.js' && fs.existsSync(p));
    if (!found) throw new Error(`npm was not found next to this Node (${process.execPath})`);
    return found;
}

// Streams the child's output to this console. Resolves { code }.
export function run(cmd, args, { cwd = ROOT, env = {}, stdio } = {}) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: stdio || ['ignore', 'inherit', 'inherit'], windowsHide: true });
        } catch (error) {
            resolve({ code: 127, error });
            return;
        }
        child.on('error', (error) => resolve({ code: 127, error }));
        child.on('close', (code) => resolve({ code: code ?? 1 }));
    });
}
export const runNpm = (args, opts) => run(process.execPath, [npmCli(), ...args], opts);

// Captures output. Returns { code, stdout, stderr }.
export function capture(cmd, args, { cwd = ROOT, env = {}, input } = {}) {
    const r = spawnSync(cmd, args, {
        cwd, env: { ...process.env, ...env }, input, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    });
    return { code: r.status ?? (r.error ? 127 : 1), stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error.message) : '') };
}

export function git(args, cwd = ROOT) {
    const r = capture('git', args, { cwd });
    if (r.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`);
    return r.stdout.trim();
}

// ---------------------------------------------------------------------------
// Release bundles.
//   <build-id>/public/            the static build (out/) plus version.txt
//   <build-id>/MANIFEST.sha256    "<sha256>  public/<path>" for every file, sorted
//   <build-id>/bundle.json        local notes (source, commit); never uploaded
// The sha256 of MANIFEST.sha256 is the bundle's identity: the number the owner
// approves after testing it on preview, and the number deploy asks for.
// ---------------------------------------------------------------------------

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const sha256File = (file) => sha256(fs.readFileSync(file));

// A path inside a bundle must be plain: no control characters, no
// backslashes, no empty, "." or ".." parts.
export function pathProblem(relPath) {
    if (/[\u0000-\u001f\u007f\\]/.test(relPath)) return 'has a control character or a backslash';
    if (relPath.split('/').some((p) => p === '' || p === '.' || p === '..')) return 'has an empty, "." or ".." part';
    return null;
}

// Every entry under dir: { rel, full, kind } with kind file | dir | other.
// Symlinks count as "other": a bundle holds plain files only.
export function walkEntries(dir, base = dir, acc = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = path.relative(base, full).split(path.sep).join('/');
        const st = fs.lstatSync(full);
        if (st.isDirectory()) {
            acc.push({ rel, full, kind: 'dir' });
            walkEntries(full, base, acc);
        } else {
            acc.push({ rel, full, kind: st.isFile() ? 'file' : 'other' });
        }
    }
    return acc;
}

const byBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function manifestText(bundleDir) {
    const files = walkEntries(path.join(bundleDir, PUBLIC))
        .filter((e) => e.kind === 'file')
        .map((e) => e.rel)
        .sort(byBytes);
    return files.map((rel) => `${sha256File(path.join(bundleDir, PUBLIC, rel))}  ${PUBLIC}/${rel}\n`).join('');
}

export function readVersion(bundleDir) {
    const file = path.join(bundleDir, PUBLIC, 'version.txt');
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')));
}

// Checks a bundle against its manifest. Collects every problem (it does not
// stop at the first one). With expectedHash, the manifest must also be that one.
export function verifyBundle(bundleDir, expectedHash = null) {
    const problems = [];
    const manifestFile = path.join(bundleDir, MANIFEST);
    if (!fs.existsSync(manifestFile)) return { ok: false, problems: [`no ${MANIFEST} in ${bundleDir}`] };
    if (!fs.existsSync(path.join(bundleDir, PUBLIC))) return { ok: false, problems: [`no ${PUBLIC}/ in ${bundleDir}`] };

    for (const name of fs.readdirSync(bundleDir)) {
        if (![MANIFEST, PUBLIC, BUNDLE_INFO].includes(name)) problems.push(`unexpected entry in the bundle: ${name}`);
    }
    const raw = fs.readFileSync(manifestFile);
    const manifestHash = sha256(raw);
    if (expectedHash && manifestHash !== expectedHash) problems.push(`manifest is ${manifestHash}, not the approved ${expectedHash}`);

    const listed = new Map();
    const text = raw.toString('utf8');
    if (text.length && !text.endsWith('\n')) problems.push('manifest does not end with a newline');
    const lines = text.split('\n');
    for (const [i, line] of lines.entries()) {
        if (line === '' && i === lines.length - 1) continue; // the final newline
        const m = line.match(/^([0-9a-f]{64}) {2}public\/(.+)$/);
        if (!m) { problems.push(`manifest line ${i + 1} is malformed`); continue; }
        const bad = pathProblem(m[2]);
        if (bad) { problems.push(`manifest line ${i + 1}: path ${bad}`); continue; }
        if (listed.has(m[2])) { problems.push(`manifest lists ${m[2]} twice`); continue; }
        listed.set(m[2], m[1]);
    }

    const entries = walkEntries(path.join(bundleDir, PUBLIC));
    for (const e of entries) {
        if (e.kind === 'other') problems.push(`not a plain file (link or special): public/${e.rel}`);
        if (e.kind !== 'file') continue;
        const want = listed.get(e.rel);
        if (!want) { problems.push(`file not in the manifest: public/${e.rel}`); continue; }
        if (sha256File(e.full) !== want) problems.push(`file does not match the manifest: public/${e.rel}`);
        listed.delete(e.rel);
    }
    for (const rel of listed.keys()) problems.push(`file in the manifest is missing: public/${rel}`);

    const version = readVersion(bundleDir);
    if (!BUILD_ID_RE.test(version.build || '')) problems.push('public/version.txt has no valid build= line');
    if (!/^[0-9a-f]{40}$/.test(version.commit || '')) problems.push('public/version.txt has no valid commit= line');

    return { ok: problems.length === 0, problems, manifestHash, files: entries.filter((e) => e.kind === 'file').length, version };
}

export function utcStamp(date = new Date()) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Copies a static build into a new bundle under parentDir and returns
// { dir, buildId, manifestHash }. The bundle is written beside its final
// name first, then renamed, so a half-written bundle never looks complete.
export function writeBundle({ srcDir, parentDir, commit, source, buildId, extra = {} }) {
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`not a full commit id: ${commit}`);
    const id = buildId || `${utcStamp()}-${commit.slice(0, 7)}`;
    if (!BUILD_ID_RE.test(id)) throw new Error(`bad build id: ${id}`);

    const problems = [];
    for (const e of walkEntries(srcDir)) {
        if (e.kind === 'other') problems.push(`not a plain file (link or special): ${e.rel}`);
        const bad = pathProblem(e.rel);
        if (bad) problems.push(`${e.rel}: path ${bad}`);
    }
    if (fs.existsSync(path.join(srcDir, 'version.txt'))) problems.push('the build already has a version.txt (it would be overwritten)');
    if (problems.length) throw new Error(`cannot package ${srcDir}:\n  - ${problems.join('\n  - ')}`);

    fs.mkdirSync(parentDir, { recursive: true });
    const final = path.join(parentDir, id);
    if (fs.existsSync(final)) throw new Error(`a bundle named ${id} already exists`);
    const tmp = path.join(parentDir, `.tmp-${id}-${process.pid}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(srcDir, path.join(tmp, PUBLIC), { recursive: true, errorOnExist: true, force: false });
    fs.writeFileSync(path.join(tmp, PUBLIC, 'version.txt'), `build=${id}\ncommit=${commit}\n`);
    const manifest = manifestText(tmp);
    fs.writeFileSync(path.join(tmp, MANIFEST), manifest);
    const manifestHash = sha256(Buffer.from(manifest));
    fs.writeFileSync(path.join(tmp, BUNDLE_INFO), `${JSON.stringify({
        buildId: id, commit, source, manifestSha256: manifestHash, createdAt: new Date().toISOString(),
        node: process.version, platform: process.platform, ...extra,
    }, null, 2)}\n`);
    const check = verifyBundle(tmp, manifestHash);
    if (!check.ok) {
        fs.rmSync(tmp, { recursive: true, force: true });
        throw new Error(`the new bundle failed its own check:\n  - ${check.problems.join('\n  - ')}`);
    }
    fs.renameSync(tmp, final);
    return { dir: final, buildId: id, manifestHash };
}

export function readBundleInfo(dir) {
    try { return JSON.parse(fs.readFileSync(path.join(dir, BUNDLE_INFO), 'utf8')); } catch { return {}; }
}

// All local bundles: { dir, buildId, manifestHash, info }, newest first.
export function listBundles(parent = bundlesDir()) {
    if (!fs.existsSync(parent)) return [];
    return fs.readdirSync(parent)
        .filter((name) => BUILD_ID_RE.test(name) && fs.existsSync(path.join(parent, name, MANIFEST)))
        .sort().reverse()
        .map((name) => {
            const dir = path.join(parent, name);
            return { dir, buildId: name, manifestHash: sha256File(path.join(dir, MANIFEST)), info: readBundleInfo(dir) };
        });
}
