// `npm run build`: runs `next build`, saves its output, then checks out/.
// The build fails (exit 1) if:
//   - any route in the route table is not static (○ or ●), or a page is missing;
//   - a list-only field or a retired app ID reaches out/ (§6.1 item 11).
// Telemetry is always off for the build. No packages: Node built-ins only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BUILD_LOG, OUT_DIR, ROOT, checkGuardedFields, checkRouteTable } from './lib/export-checks.mjs';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next', { paths: [ROOT] });

function runNextBuild() {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [nextBin, 'build'], {
            cwd: ROOT,
            env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let log = '';
        child.stdout.on('data', (chunk) => { log += chunk; process.stdout.write(chunk); });
        child.stderr.on('data', (chunk) => { log += chunk; process.stderr.write(chunk); });
        child.on('close', (code) => resolve({ code: code ?? 1, log }));
    });
}

const { code, log } = await runNextBuild();
fs.mkdirSync(path.dirname(BUILD_LOG), { recursive: true });
fs.writeFileSync(BUILD_LOG, log);
if (code !== 0) {
    console.error(`\nnext build failed (exit ${code}).`);
    process.exit(code);
}

const problems = [];
const routes = checkRouteTable(log);
problems.push(...routes.problems.map((p) => `route table: ${p}`));
const guarded = checkGuardedFields(OUT_DIR);
problems.push(...guarded.hits.map((h) => `guarded field: ${h}`));

if (problems.length) {
    console.error('\nBuild checks FAILED:');
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
    process.exit(1);
}
console.log(`\nBuild checks passed: ${routes.rows.filter((r) => r.sym).length} static routes; ` +
    `${guarded.scanned} text files in out/ free of list-only fields` +
    `${guarded.retired.length ? ` and retired IDs (${guarded.retired.join(', ')})` : ''}.`);
