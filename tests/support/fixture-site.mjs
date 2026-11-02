// TEST-ONLY copies of the site, for checks that need a build the real app
// list can't give (the heading guard, the content check). The site is copied
// into test-results/ (git-ignored), changed in the COPY only, and built with
// the same guarded build script. app/, lib/ and content/ are never touched, and a
// copy never gets a .env. Each spec deletes its copies when it is done.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/lib/export-checks.mjs';

export const BUILD_TIMEOUT = 180_000;
// Everything the build reads. Never .env: a fixture build gets no settings.
const COPY = ['app', 'lib', 'content', 'public', 'scripts/build.mjs', 'scripts/lib', 'next.config.mjs', 'postcss.config.mjs', 'jsconfig.json', 'package.json'];

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

// Copies the site into dir (emptied first).
export function copySite(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const item of COPY) fs.cpSync(path.join(ROOT, item), path.join(dir, item), { recursive: true });
}

// The copy's own guarded build (scripts/build.mjs). It finds next in the
// project's node_modules, further up. Resolves with { code, log }.
export function buildCopy(dir) {
    return run([path.join(dir, 'scripts', 'build.mjs')], dir);
}

export function removeCopy(dir) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
