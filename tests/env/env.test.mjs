// Settings (environment variables) must never end up in the static site.
// With a static export, anything the build reads from the environment is
// baked into the files in out/: NEXT_PUBLIC_* values go into the browser
// code, and any process.env value a page renders goes into its HTML.
//
// Run with: npm run test:env   (node's built-in test runner)
// It does its own build with fake values, then DELETES that out/, so run it
// BEFORE `npm run build` (npm test does this in the right order).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_LOG, OUT_DIR, ROOT, rel, walk } from '../../scripts/lib/export-checks.mjs';

// Allow-lists. Adding a name or file here is a reviewed decision.
const ALLOWED_PUBLIC_VARS = []; // NEXT_PUBLIC_* names the site may use
const ALLOWED_PROCESS_ENV_FILES = []; // files under src/ or content/ that may read process.env

const SOURCE_DIRS = ['src', 'content'];
const ROOT_CONFIG = ['next.config.mjs', 'postcss.config.mjs', 'eslint.config.mjs', 'jsconfig.json'];
const SOURCE_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css']);

function sourceFiles() {
    const files = SOURCE_DIRS.flatMap((d) => walk(path.join(ROOT, d)))
        .filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase()));
    return [...files, ...ROOT_CONFIG.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))];
}

test('the source uses no NEXT_PUBLIC_ setting and src/ + content/ never read process.env', () => {
    const problems = [];
    for (const file of sourceFiles()) {
        const name = rel(ROOT, file);
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*/g)) {
            if (!ALLOWED_PUBLIC_VARS.includes(m[0])) problems.push(`${name}: ${m[0]}`);
        }
        const inSiteCode = SOURCE_DIRS.some((d) => name.startsWith(`${d}/`));
        if (inSiteCode && !ALLOWED_PROCESS_ENV_FILES.includes(name)) {
            for (const m of text.matchAll(/process\s*\.\s*env|process\s*\[\s*['"]env['"]\s*\]/g)) {
                const line = text.slice(0, m.index).split('\n').length;
                problems.push(`${name}:${line}: reads process.env`);
            }
        }
    }
    assert.deepEqual(problems, []);
});

test('a build with fake settings bakes none of them into out/', () => {
    const fake = () => `fake${crypto.randomBytes(12).toString('hex')}`;
    const template = fs.readFileSync(path.join(ROOT, '.env.template'), 'utf8');
    const names = new Set([
        'NEXT_PUBLIC_E2E_CANARY', // a public setting nobody should read
        'E2E_SERVER_CANARY', // a server-side setting nobody should render
        'NEXT_PUBLIC_MAINTENANCE_MODE', // the old site's switch (removed in BUWEB-104a)
        ...[...template.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]), // every name in .env.template
    ]);
    const values = Object.fromEntries([...names].map((n) => [n, fake()]));

    const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], {
        cwd: ROOT,
        env: { ...process.env, ...values, NEXT_TELEMETRY_DISABLED: '1' },
        encoding: 'utf8',
        timeout: 300_000,
    });
    try {
        assert.equal(build.status, 0, `the fake-value build failed:\n${build.stdout}\n${build.stderr}`);
        const leaks = [];
        const files = walk(OUT_DIR);
        assert.ok(files.length > 20, 'out/ looks empty');
        for (const file of files) {
            const bytes = fs.readFileSync(file).toString('latin1');
            for (const [name, value] of Object.entries(values)) {
                if (bytes.includes(value)) leaks.push(`${name} is in ${rel(OUT_DIR, file)}`);
            }
        }
        assert.deepEqual(leaks, []);
    } finally {
        // Never leave a fake-value build behind for anyone to test or ship.
        fs.rmSync(OUT_DIR, { recursive: true, force: true });
        fs.rmSync(BUILD_LOG, { force: true });
    }
});
