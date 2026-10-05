// Fixes the known Next 16.3.8 WINDOWS export bug (tests/README.md, "Known:
// the Windows build bug"): some page-data files land in folders instead of
// under dotted names, so the browser gets 404s for them.
//   wrong (Windows): out/about/__next.about/__PAGE__.txt
//   right (Linux):   out/about/__next.about.__PAGE__.txt
// Moves each misnamed file to the name the browser asks for, removes the
// folders left empty, then checks that no misnamed file is left. The test
// suite proved this rename safe (a renamed Windows build passes the strict
// "no 404s" test). A Linux build has nothing to fix.
//
//   node scripts/release/fix-windows-export.mjs [out-dir]
//
// The release gate runs this on Windows, then runs the browser tests with
// E2E_STRICT_404=1, so the renamed build is what gets tested and packaged.
import fs from 'node:fs';
import path from 'node:path';
import { misnamedPageDataFiles } from '../../tests/support/windows-export-bug.mjs';
import { ROOT, isInside, isMain } from './lib.mjs';

export function fixWindowsExport(outDir = path.join(ROOT, 'out')) {
    const moved = [];
    const failed = [];
    const emptied = new Set();
    // One bad file must not stop the others: each move is tried, and every
    // failure is reported at the end.
    for (const { file, url } of misnamedPageDataFiles(outDir)) {
        try {
            const from = path.join(outDir, file);
            const to = path.join(outDir, ...url.split('/').filter(Boolean));
            if (!isInside(to, outDir)) throw new Error('target is outside out/');
            if (fs.existsSync(to)) throw new Error('target already exists');
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.renameSync(from, to);
            moved.push({ file, url });
            emptied.add(path.dirname(from));
        } catch (err) {
            failed.push(`${file} -> ${url}: ${err.message}`);
        }
    }
    // Remove the folders the moves left empty, deepest first.
    for (const start of [...emptied].sort((a, b) => b.length - a.length)) {
        let dir = start;
        while (isInside(dir, outDir) && path.resolve(dir) !== path.resolve(outDir)) {
            try {
                if (fs.readdirSync(dir).length) break;
                fs.rmdirSync(dir);
            } catch (err) {
                if (err.code !== 'ENOENT') failed.push(`could not remove empty folder ${path.relative(outDir, dir)}: ${err.message}`);
                break;
            }
            dir = path.dirname(dir);
        }
    }
    const remaining = misnamedPageDataFiles(outDir);
    return { moved, failed, remaining, ok: failed.length === 0 && remaining.length === 0 };
}

if (isMain(import.meta.url)) {
    const outDir = path.resolve(process.argv[2] || path.join(ROOT, 'out'));
    if (!fs.existsSync(path.join(outDir, 'index.html'))) {
        console.error(`No static build at ${outDir}. Run "npm run build" first.`);
        process.exit(1);
    }
    const r = fixWindowsExport(outDir);
    console.log(`Windows export fix: ${r.moved.length} file(s) renamed.`);
    for (const m of r.moved) console.log(`  ${m.file} -> ${m.url.slice(1)}`);
    for (const f of r.failed) console.error(`  FAILED: ${f}`);
    if (r.remaining.length) console.error(`  STILL MISNAMED: ${r.remaining.map((m) => m.file).join(', ')}`);
    process.exit(r.ok ? 0 : 1);
}
