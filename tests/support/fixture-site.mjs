// TEST-ONLY copies of the site, for checks that need a build the real app
// list can't give (the heading guard, the content check). The site is copied
// into src/.fixture-sites/ (git-ignored), changed in the COPY only, and built with
// the same guarded build script. app/, lib/ and content/ are never touched, and a
// copy never gets a .env. Each spec deletes its copies when it is done.
// A copy has the repo's shape (src/, scripts/, tests/fixtures/), so the copied
// build script finds everything where it does in the repo.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/lib/export-checks.mjs';

export const BUILD_TIMEOUT = 180_000;
// Inside src/, so a copy's build finds next in src/node_modules, further up.
export const FIXTURE_SITES = path.join(ROOT, '.fixture-sites');
const REPO_ROOT = path.resolve(ROOT, '..');
// Everything the build reads, from the repo top. Never .env: a fixture build gets no settings.
const COPY = ['src/app', 'src/lib', 'src/content', 'src/public', 'src/next.config.mjs', 'src/postcss.config.mjs', 'src/jsconfig.json',
    'src/package.json', 'scripts/build.mjs', 'scripts/lib', 'tests/fixtures/public-allowlist.txt'];

// A copy's site folder: its content/, public/ and out/ are in here.
export const siteOf = (dir) => path.join(dir, 'src');

export function run(args, cwd) {
    // Plain text output: Playwright's workers set FORCE_COLOR, and colour
    // codes in the build log hide the route table from the build checks.
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1' };
    delete env.FORCE_COLOR;
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let log = '';
        child.stdout.on('data', (c) => { log += c; });
        child.stderr.on('data', (c) => { log += c; });
        child.on('close', (code) => resolve({ code: code ?? 1, log }));
    });
}

// Copies the site into dir (emptied first). Every item is tried; any that
// failed are listed together, then the copy fails once (Rob's loop rule).
export function copySite(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    const failed = [];
    for (const item of COPY) {
        try {
            fs.cpSync(path.join(REPO_ROOT, item), path.join(dir, item), { recursive: true });
        } catch (err) {
            failed.push(`${item}: ${err.message}`);
        }
    }
    if (failed.length) throw new Error(`could not copy the site into ${dir}:\n  - ${failed.join('\n  - ')}`);
}

// The copy's own guarded build (scripts/build.mjs), run from the copy's src/
// as `npm run build` runs from src/. Resolves with { code, log }.
export function buildCopy(dir) {
    return run([path.join(dir, 'scripts', 'build.mjs')], siteOf(dir));
}

export function removeCopy(dir) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
