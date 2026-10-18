// Packs the static build (out/) into a release bundle: out/ plus version.txt,
// with MANIFEST.sha256 (the sha256 of every file) beside it. The sha256 of
// MANIFEST.sha256 is the bundle's identity: the number the owner approves after
// testing the bundle on preview, and the number the deploy script asks for.
//
//   node scripts/release/package.mjs --out <folder> [--source <label>]
//
// The bundle lands in <folder>/<build-id>/ (build id = UTC time + short commit).
// CI runs this after every check passes; the local gate runs it the same way.
// Refuses: a dirty tree (any tracked change or untracked file), a missing
// build, a Windows build that still has the misnamed page-data files, and a
// build the guard (scripts/build.mjs) did not pass: no saved build log, a
// route-table problem in that log, a guarded field in out/, or a file in out/
// newer than the log (out/ changed after the guarded build). A bare
// `next build` wipes .next/, so it leaves no log and cannot be packaged.
// It also re-runs the build's other checks on these exact files, so a build
// that failed them can never be packaged by hand: the site settings agree with
// the page folders, public/ holds only allow-listed files (git-ignored ones
// included), and nothing of a hidden page is in out/.
import fs from 'node:fs';
import path from 'node:path';
import { misnamedPageDataFiles } from '../../tests/support/windows-export-bug.mjs';
import {
    BUILD_LOG, OUT_DIR,
    checkGuardedFields, checkHiddenContent, checkPublicAllowlist, checkRouteTable, checkSettingsMatchFolders, rel, walk,
} from '../lib/export-checks.mjs';
import { git, writeBundle } from './lib.mjs';

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outArg = arg('out');
const source = arg('source', 'local');
if (!outArg) {
    console.error('Usage: node scripts/release/package.mjs --out <folder> [--source <label>]');
    process.exit(2);
}

const refusals = [];
const dirty = git(['status', '--porcelain']);
if (dirty) refusals.push(`the working tree is not clean (package from a clean clone or CI):\n${dirty.split('\n').map((l) => `      ${l}`).join('\n')}`);
const outDir = OUT_DIR;
if (!fs.existsSync(path.join(outDir, 'index.html'))) refusals.push('no build in out/ (run "npm run build")');
else {
    const misnamed = misnamedPageDataFiles(outDir);
    if (misnamed.length) {
        refusals.push(`out/ still has ${misnamed.length} misnamed page-data file(s) from the Windows build bug; ` +
            'run "node scripts/release/fix-windows-export.mjs" first (the gate does this)');
    }
    // The build guard must have passed on these exact bytes.
    if (!fs.existsSync(BUILD_LOG)) {
        refusals.push('no guarded build log (.next/bengusa-build.log): build with "npm run build", never "next build" directly');
    } else {
        refusals.push(...checkRouteTable(fs.readFileSync(BUILD_LOG, 'utf8')).problems.map((p) => `route table: ${p}`));
        const logTime = fs.statSync(BUILD_LOG).mtimeMs;
        const newer = walk(outDir).filter((f) => fs.statSync(f).mtimeMs > logTime);
        if (newer.length) refusals.push(`${newer.length} file(s) in out/ changed after the guarded build (newer than its log), e.g. ${rel(outDir, newer[0])}`);
    }
    refusals.push(...checkGuardedFields(outDir).hits.map((h) => `guarded field: ${h}`));
    refusals.push(...checkHiddenContent(outDir).hits.map((h) => `hidden content: ${h}`));
}
refusals.push(...checkSettingsMatchFolders().problems.map((p) => `site settings: ${p}`));
refusals.push(...checkPublicAllowlist().problems.map((p) => `public/: ${p}`));
if (refusals.length) {
    console.error('Package REFUSED:');
    for (const r of refusals) console.error(`  - ${r}`);
    process.exit(1);
}

const commit = git(['rev-parse', 'HEAD']);
const extra = {};
if (process.env.GITHUB_RUN_ID) {
    extra.ciRunUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    extra.ciEvent = process.env.GITHUB_EVENT_NAME;
    extra.ciRef = process.env.GITHUB_REF;
}

try {
    const b = writeBundle({ srcDir: outDir, parentDir: path.resolve(outArg), commit, source, extra });
    console.log(`Packaged build ${b.buildId}`);
    console.log(`  bundle:   ${b.dir}`);
    console.log(`  manifest: ${b.manifestHash}   <- the number to approve and deploy`);
    if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
            `### Release bundle\n\n| | |\n|---|---|\n| Build | \`${b.buildId}\` |\n| Commit | \`${commit}\` |\n` +
            `| Manifest sha256 | \`${b.manifestHash}\` |\n\nDeploy from the laptop: ` +
            `\`node scripts/deploy/deploy.mjs fetch-ci ${process.env.GITHUB_RUN_ID}\`, then ` +
            `\`deploy --target preview --manifest ${b.manifestHash}\`.\n`);
    }
} catch (err) {
    console.error(`Package FAILED: ${err.message}`);
    process.exit(1);
}
