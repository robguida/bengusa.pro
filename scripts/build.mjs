// `npm run build`: runs `next build`, saves its output, then checks out/.
// The build fails (exit 1) if:
//   - content/site-settings.json is missing, isn't JSON, or a switch in it is
//     missing or not true/false; or it and the page folders disagree (a hidden
//     page's folder must sit in src/app/_parked/, a shown page's must not);
//   - public/ holds a file that tests/fixtures/public-allowlist.txt does not
//     name, tracked or not (every file there is served), or misses one it names;
//   - any route in the route table is not static (○ or ●), a page is missing,
//     or a hidden page was built;
//   - a list-only field or a retired app ID reaches out/ (§6.1 item 11);
//   - anything of a hidden page reaches out/: its files, or its names, words,
//     links or menu in any text file; or the old draft label appears anywhere;
//     or a hidden app's ID, name, short name or slug is too short to scan for;
//   - a page's security policy can't be written, or doesn't match the page;
//   - a file in out/ that a check must read can't be read (it is listed, and
//     the check goes on to the next file).
// After `next build` it writes each page's Content-Security-Policy meta tag
// (scripts/lib/csp.mjs), then saves the build log, so the log is newer than
// every file in out/ (scripts/release/package.mjs refuses anything newer).
// Every check runs to the end and every problem is listed (Rob's loop rule).
// Telemetry is always off for the build. No packages: Node built-ins only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    BUILD_LOG, OUT_DIR, ROOT,
    checkGuardedFields, checkHiddenContent, checkPublicAllowlist, checkRouteTable, checkSettingsMatchFolders,
} from './lib/export-checks.mjs';
import { checkCsp, injectCsp } from './lib/csp.mjs';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next', { paths: [ROOT] });

function runNextBuild() {
    // Plain-text log: a console's FORCE_COLOR would put colour codes inside the
    // "Route (app)" line and the route-table check would not find it.
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1' };
    delete env.FORCE_COLOR;
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [nextBin, 'build'], {
            cwd: ROOT,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let log = '';
        child.stdout.on('data', (chunk) => { log += chunk; process.stdout.write(chunk); });
        child.stderr.on('data', (chunk) => { log += chunk; process.stderr.write(chunk); });
        child.on('close', (code) => resolve({ code: code ?? 1, log }));
    });
}

function report(problems) {
    console.error(`\nBuild checks FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
    for (const p of problems) console.error(`  - ${p}`);
}

// Checked before the build, but reported with everything else at the end.
const problems = [
    ...checkSettingsMatchFolders().problems.map((p) => `site settings: ${p}`),
    ...checkPublicAllowlist().problems.map((p) => `public/: ${p}`),
];

const { code, log } = await runNextBuild();
if (code !== 0) {
    fs.mkdirSync(path.dirname(BUILD_LOG), { recursive: true });
    fs.writeFileSync(BUILD_LOG, log);
    console.error(`\nnext build failed (exit ${code}).`);
    if (problems.length) report(problems);
    process.exit(code);
}

// The pages' security policies are written before the log is saved.
const written = injectCsp(OUT_DIR);
problems.push(...written.problems.map((p) => `security policy: ${p}`));

fs.mkdirSync(path.dirname(BUILD_LOG), { recursive: true });
fs.writeFileSync(BUILD_LOG, log);

const routes = checkRouteTable(log);
problems.push(...routes.problems.map((p) => `route table: ${p}`));
const guarded = checkGuardedFields(OUT_DIR);
problems.push(...guarded.hits.map((h) => `guarded field: ${h}`));
const hidden = checkHiddenContent(OUT_DIR);
problems.push(...hidden.hits.map((h) => `hidden content: ${h}`));
const csp = checkCsp(OUT_DIR);
problems.push(...csp.problems.map((p) => `security policy: ${p}`));

if (problems.length) {
    report(problems);
    process.exit(1);
}
console.log(`\nBuild checks passed: ${routes.rows.filter((r) => r.sym).length} static routes; ` +
    `${guarded.scanned} text files in out/ free of list-only fields` +
    `${guarded.retired.length ? ` and retired IDs (${guarded.retired.join(', ')})` : ''}, ` +
    `and of hidden pages' content (${hidden.patterns} patterns); public/ matches its allow-list; ` +
    `security policy written and checked on ${csp.pages} pages.`);
