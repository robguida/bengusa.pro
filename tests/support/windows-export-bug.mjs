// Known bug: Next 16.3.8 static export on WINDOWS writes some page-data files
// under the wrong names. It builds the name with path.relative() (backslashes),
// then only swaps "/" for ".", so each backslash becomes a folder:
//   wrong (Windows): out/about/__next.about/__PAGE__.txt
//   right (Linux):   out/about/__next.about.__PAGE__.txt
// The browser asks for the right name and gets a 404 (page links still work;
// only the prefetch is lost). A Linux build is correct.
import { OUT_DIR, rel, walk } from '../../scripts/lib/export-checks.mjs';

// Returns one entry per misnamed file: { file, url } where url is the address
// the browser asks for. An empty list = no sign of the bug in this build.
export function misnamedPageDataFiles(outDir = OUT_DIR) {
    const found = [];
    for (const file of walk(outDir)) {
        const parts = rel(outDir, file).split('/');
        const at = parts.findIndex((p, i) => i < parts.length - 1 && p.startsWith('__next.'));
        if (at < 0) continue;
        const pageDir = parts.slice(0, at);
        const name = parts.slice(at).join('.');
        found.push({ file: rel(outDir, file), url: `/${[...pageDir, name].join('/')}` });
    }
    return found;
}

export function describeBug(found) {
    return `Windows export bug: ${found.length} page-data files are misnamed in out/ ` +
        `(e.g. ${found[0]?.file} should be at ${found[0]?.url}). Build on Linux (CI or WSL) ` +
        'or rename the files after the build. See tests/README.md.';
}

export const pathOf = (url) => decodeURIComponent(new URL(url).pathname);
