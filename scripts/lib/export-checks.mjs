// Checks on the static export (out/) and the build log. Used by
// scripts/build.mjs (a failed check fails the build) and by the test suite.
// No packages: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = path.join(ROOT, 'out');
// scripts/build.mjs saves the full `next build` output here.
export const BUILD_LOG = path.join(ROOT, '.next', 'bengusa-build.log');

// Files read as text by the content checks. Fonts, images and other binary
// files are skipped: random bytes give false hits.
export const TEXT_EXT = new Set(['.html', '.txt', '.js', '.mjs', '.css', '.svg', '.json', '.xml', '.map', '.webmanifest']);

export function walk(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else acc.push(full);
    }
    return acc;
}

export function rel(dir, file) {
    return path.relative(dir, file).split(path.sep).join('/');
}

export function textFiles(dir) {
    return walk(dir).filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
}

export function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// The pages the site must build, as static files. The app pages come from the
// app list, so adding an app adds its page here too.
export function expectedRoutes(root = ROOT) {
    const apps = readJson(path.join(root, 'content', 'apps.json'));
    const appRoutes = apps
        .filter((app) => app.status === 'open' || app.status === 'showcase')
        .map((app) => `/apps/${app.slug}`);
    return ['/', '/about', '/contact', '/privacy', ...appRoutes];
}

// ---------------------------------------------------------------------------
// Route table: every route in the `next build` table must be static.
// ○ = static, ● = static via generateStaticParams. Anything else (ƒ server,
// ◐ partial prerender, a row with no marker) fails. Why: with output 'export'
// a server-only route (for example a POST-only API route) still builds green,
// then is silently left out of out/.
// ---------------------------------------------------------------------------
export function checkRouteTable(logText, wanted = expectedRoutes()) {
    const lines = logText.split(/\r?\n/);
    const start = lines.findIndex((l) => /^Route \(app\)/.test(l));
    if (start < 0) {
        return { ok: false, rows: [], problems: ['no "Route (app)" table in the build log'] };
    }
    const rows = [];
    const problems = [];
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!/^[┌├└│]/u.test(line)) break;
        const m = line.match(/^([┌├└│─\s]*)(\S)?\s*(\/\S*)/u);
        if (!m) {
            problems.push(`row not understood: ${line.trim()}`);
            continue;
        }
        const sym = m[2] === undefined || m[2] === '/' ? null : m[2];
        const depth = (m[1].match(/[┌├└│]/gu) || []).length;
        rows.push({ sym, route: m[3], depth, raw: line.trim() });
    }
    rows.forEach((row, i) => {
        if (row.sym === null) {
            // A row with no marker is fine only as the parent of a dynamic
            // route, followed by its static children (e.g. /apps/[slug]).
            const next = rows[i + 1];
            const isParent = next && next.depth > row.depth && next.route.startsWith(row.route.split('[')[0]);
            if (!isParent) problems.push(`no static marker: ${row.raw}`);
        } else if (row.sym !== '○' && row.sym !== '●') {
            problems.push(`not static (${row.sym}): ${row.raw}`);
        }
    });
    const built = new Set(rows.filter((r) => r.sym === '○' || r.sym === '●').map((r) => r.route));
    for (const route of wanted) {
        if (!built.has(route)) problems.push(`missing static route ${route}`);
    }
    return { ok: problems.length === 0, rows, problems };
}

// ---------------------------------------------------------------------------
// Guarded fields (architecture §6.1 item 11): the browser never gets the
// list-only fields or a retired app. Fails if any text file under out/ holds
//   - freeBeta or templatesCheckedAt (anywhere),
//   - sold as an object key ("sold": / sold: / \"sold\":), so page copy can
//     still use the word,
//   - a retired app ID as a quoted string.
// Retired IDs = apps.json entries with status "retired", plus any ledger ID
// that is no longer in apps.json.
// ---------------------------------------------------------------------------
export function retiredIds(root = ROOT) {
    const apps = readJson(path.join(root, 'content', 'apps.json'));
    const ledger = fs.readFileSync(path.join(root, 'content', 'app-ids.ledger'), 'utf8')
        .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const listed = new Set(apps.map((a) => a.id));
    const retired = new Set(apps.filter((a) => a.status === 'retired').map((a) => a.id));
    for (const id of ledger) if (!listed.has(id)) retired.add(id);
    return [...retired].sort();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function guardedPatterns(retired = retiredIds()) {
    const quote = String.raw`(?:\\?["'\x60])`; // " ' ` or an escaped \" inside an RSC payload
    const patterns = [
        { name: 'freeBeta', re: /freeBeta/g },
        { name: 'templatesCheckedAt', re: /templatesCheckedAt/g },
        { name: 'sold (as a key)', re: new RegExp(String.raw`${quote}sold${quote}\s*:|[{,]\s*sold\s*:`, 'g') },
    ];
    for (const id of retired) {
        patterns.push({ name: `retired ID "${id}"`, re: new RegExp(`${quote}${escapeRe(id)}${quote}`, 'g') });
    }
    return patterns;
}

export function checkGuardedFields(outDir = OUT_DIR, retired = retiredIds()) {
    const patterns = guardedPatterns(retired);
    const hits = [];
    const files = textFiles(outDir);
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const { name, re } of patterns) {
            for (const m of text.matchAll(re)) {
                const s = Math.max(0, m.index - 30);
                hits.push(`${name} in ${rel(outDir, file)}: …${text.slice(s, m.index + m[0].length + 30).replace(/\s+/g, ' ')}…`);
            }
        }
    }
    return { ok: hits.length === 0, scanned: files.length, retired, hits };
}
