// Checks on the static export (out/) and the build log. Used by
// scripts/build.mjs (a failed check fails the build) and by the test suite.
// No packages: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_SETTINGS_FILE, SITE_SWITCH_KEYS, checkSiteSettings } from '../../lib/site-settings.mjs';

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

// Reads one file for a scan of many. A file that can't be read is listed as a
// problem of its own and the scan goes on to the next file (Rob's loop rule),
// so one bad file never hides the rest. The check still fails.
export function readForScan(dir, file, problems) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        problems.push(`${rel(dir, file)}: could not read: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// The site switch, content/site-settings.json (BUWEB-114): what the live site
// shows. A hidden page's folder sits in src/app/_parked/, so Next builds
// nothing for it, and src/lib/site.js leaves it out of every list. The code is
// kept. What the file means is one rule, src/lib/site-settings.mjs, shared by
// site.js, these checks and the tests.
// ---------------------------------------------------------------------------
export const SETTINGS_FILE = SITE_SETTINGS_FILE;

// key: the switch. what: for messages. folder: its page folder under src/app/.
// route: its address. One row per key in SITE_SWITCH_KEYS.
export const SWITCHES = [
    { key: 'showApps', what: 'the apps are', folder: 'apps', route: '/apps' },
    { key: 'showContact', what: 'Contact is', folder: 'contact', route: '/contact' },
];

// The one reader of content/site-settings.json in Node. Returns
// { showApps, showContact, problems }. Each switch must be true or false: a
// missing switch, any other value, a missing file or a file that isn't JSON is
// a problem (the build fails), and only true shows a page, so anything broken
// counts as hidden (fail closed). Every problem is listed.
export function readSiteSettings(root = ROOT) {
    const file = path.join(root, SETTINGS_FILE);
    let raw;
    try {
        raw = readJson(file);
    } catch (err) {
        let why = `could not be read: ${err.message}`;
        if (err.code === 'ENOENT') why = 'is missing';
        else if (err instanceof SyntaxError) why = `is not valid JSON: ${err.message}`;
        const hidden = Object.fromEntries(SITE_SWITCH_KEYS.map((key) => [key, false]));
        return { ...hidden, problems: [`${SETTINGS_FILE} ${why}`] };
    }
    return checkSiteSettings(raw);
}

// The pages the site must build, as static files. The app pages come from the
// app list, so adding an app adds its page here too. Hidden pages are left out.
export function expectedRoutes(root = ROOT) {
    const { showApps, showContact } = readSiteSettings(root);
    const apps = readJson(path.join(root, 'content', 'apps.json'));
    const appRoutes = showApps
        ? apps.filter((app) => app.status === 'open' || app.status === 'showcase').map((app) => `/apps/${app.slug}`)
        : [];
    return ['/', '/about', ...(showContact ? ['/contact'] : []), '/privacy', ...appRoutes];
}

// The addresses that must NOT be built: each hidden switch's route, and
// everything under it.
export function hiddenRoutes(root = ROOT) {
    const settings = readSiteSettings(root);
    return SWITCHES.filter((s) => !settings[s.key]).map((s) => s.route);
}

const underRoute = (route, base) => route === base || route.startsWith(`${base}/`);

// The switch and the folders must agree, so the code is never lost and never
// built by mistake. Shown: src/app/<folder>/ exists and src/app/_parked/<folder>/
// does not. Hidden: the reverse.
export function checkSettingsMatchFolders(root = ROOT) {
    const settings = readSiteSettings(root);
    const problems = [...settings.problems];
    for (const { key, what, folder } of SWITCHES) {
        const live = fs.existsSync(path.join(root, 'app', folder));
        const parked = fs.existsSync(path.join(root, 'app', '_parked', folder));
        const where = `(${SETTINGS_FILE} has "${key}": ${settings[key]})`;
        if (settings[key]) {
            if (!live) problems.push(`${what} shown, but src/app/${folder}/ is missing ${where}: move it back from src/app/_parked/`);
            if (parked) problems.push(`${what} shown, but src/app/_parked/${folder}/ still exists ${where}`);
        } else {
            if (live) problems.push(`${what} hidden, but src/app/${folder}/ exists, so Next would build it ${where}: move it to src/app/_parked/`);
            if (!parked) problems.push(`${what} hidden, but the code is not in src/app/_parked/${folder}/ ${where}: it must be kept`);
        }
    }
    return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// public/ allow-list (Cora, BUWEB-114): every file in public/ is copied into
// out/ and served, whether git tracks it or not, so the build fails on any file
// there that tests/fixtures/public-allowlist.txt does not name. This walks the
// folder itself, so untracked and git-ignored files are caught too. An
// allow-listed file that is missing is reported as well.
// ---------------------------------------------------------------------------
export const PUBLIC_ALLOWLIST = 'tests/fixtures/public-allowlist.txt';

export function checkPublicAllowlist(root = ROOT) {
    const listFile = path.join(root, PUBLIC_ALLOWLIST);
    if (!fs.existsSync(listFile)) return { ok: false, problems: [`${PUBLIC_ALLOWLIST} is missing`], strays: [], missing: [] };
    const allowed = fs.readFileSync(listFile, 'utf8')
        .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const publicDir = path.join(root, 'public');
    const actual = fs.existsSync(publicDir) ? walk(publicDir).map((f) => rel(publicDir, f)) : [];
    const listed = new Set(allowed);
    const present = new Set(actual);
    const strays = actual.filter((f) => !listed.has(f)).sort();
    const missing = allowed.filter((f) => !present.has(f)).sort();
    const problems = [
        ...strays.map((f) => `public/${f} is not on ${PUBLIC_ALLOWLIST} (it would be served): remove it, or add it to the list in a reviewed commit`),
        ...missing.map((f) => `public/${f} is on ${PUBLIC_ALLOWLIST} but missing`),
    ];
    return { ok: problems.length === 0, problems, strays, missing };
}

// ---------------------------------------------------------------------------
// Route table: every route in the `next build` table must be static.
// ○ = static, ● = static via generateStaticParams. Anything else (ƒ server,
// ◐ partial prerender, a row with no marker) fails. Why: with output 'export'
// a server-only route (for example a POST-only API route) still builds green,
// then is silently left out of out/.
// ---------------------------------------------------------------------------
// hidden: routes that must not be built (content/site-settings.json). A hidden
// route that still builds would pass every "static" check, so it is named.
export function checkRouteTable(logText, wanted = expectedRoutes(), hidden = hiddenRoutes()) {
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
    for (const row of rows) {
        const base = hidden.find((h) => underRoute(row.route, h));
        if (base) problems.push(`hidden page built: ${row.route} (${SETTINGS_FILE} hides ${base})`);
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
        const text = readForScan(outDir, file, hits);
        if (text === null) continue;
        for (const { name, re } of patterns) {
            for (const m of text.matchAll(re)) {
                const s = Math.max(0, m.index - 30);
                hits.push(`${name} in ${rel(outDir, file)}: …${text.slice(s, m.index + m[0].length + 30).replace(/\s+/g, ' ')}…`);
            }
        }
    }
    return { ok: hits.length === 0, scanned: files.length, retired, hits };
}

// ---------------------------------------------------------------------------
// Hidden content (BUWEB-114). While content/site-settings.json hides the apps
// or Contact, nothing of theirs may reach out/: no page or page-data file, and
// no name, words, link or menu in any text file (pages, page data, scripts,
// styles). Always banned: the old draft label, "Draft words. Not final.".
// The words to look for are read from the content files, so a new app or a
// new line is covered with no change here. Every file is read in full and
// every hit is listed (Rob's loop rule).
// ---------------------------------------------------------------------------

// Lines the legal reviewer cut from the live words for Release 1 (ruling 1.1).
// They point at app pages and a store that are not shown.
const CUT_WHILE_APPS_HIDDEN = [
    "Each app's page lists what it connects to.",
    'If you buy it, all we keep is your purchase record.',
];
// The parked Contact page's own words (src/app/_parked/contact/page.js).
const CONTACT_PAGE_WORDS = ['Say hi.', 'The contact form comes in a later build.'];
// The old "Draft words. Not final." label (BUWEB-114 took it off every page and
// deleted it). Banned whatever the switch says, so it can't come back.
const DRAFT_LABEL_WORDS = ['Draft words', 'Not final'];

function stringsIn(value, acc = []) {
    if (typeof value === 'string') acc.push(value);
    else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, acc));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, acc));
    return acc;
}

// "TimeTracker" -> "Time Tracker"
const spacedCamel = (s) => s.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');

// The words as whole words, in any case, with any run of spaces between them.
function phraseRe(text) {
    const words = text.trim().split(/\s+/).map(escapeRe);
    return new RegExp(String.raw`(?<![\p{L}\p{N}])` + words.join(String.raw`\s+`) + String.raw`(?![\p{L}\p{N}])`, 'giu');
}

// A phrase needs this many letters to be scanned for: "." or "OK" would hit
// everything.
export const MIN_SCAN_LETTERS = 4;
const phraseText = (raw) => String(raw).replace(/\{offGrid\}/g, 'Off-grid').trim();
const letterCount = (text) => (text.match(/\p{L}/gu) || []).length;
// The app fields that name an app. Any of them may appear on a page, so each
// one must be scannable.
const APP_NAME_FIELDS = ['id', 'name', 'shortName', 'slug'];

// Returns { patterns, problems }. A short line of words is skipped (see
// MIN_SCAN_LETTERS), but a short app ID, name, short name or slug is a problem:
// it can't be scanned for safely, so the build fails and a person decides.
export function hiddenPatterns(root = ROOT, settings = readSiteSettings(root)) {
    const patterns = [];
    const problems = [];
    const seen = new Set();
    const phrase = (group, raw) => {
        const text = phraseText(raw);
        if (letterCount(text) < MIN_SCAN_LETTERS) return;
        const key = `${group}|${text.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        patterns.push({ name: `${group}: "${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`, re: phraseRe(text) });
    };
    // A link (href, or a page-data address) to the route or anything under it.
    const link = (group, route) => patterns.push({
        name: `${group}: a link to ${route}/`,
        re: new RegExp(escapeRe(route) + String.raw`(?=[/"'?#\s\\]|$)`, 'g'),
    });
    // A rendered menu label or link text: >Apps< in a page, "children":"Apps" in page data.
    const label = (group, word) => patterns.push({
        name: `${group}: a "${word}" menu or link`,
        re: new RegExp(String.raw`(?:>|"children":")\s*` + escapeRe(word) + String.raw`\s*(?:<|")`, 'g'),
    });
    const content = (file) => readJson(path.join(root, 'content', file));

    if (!settings.showApps) {
        const group = 'hidden apps';
        content('apps.json').forEach((app, i) => {
            for (const field of APP_NAME_FIELDS) {
                const value = app[field];
                if (typeof value !== 'string') continue;
                if (letterCount(phraseText(value)) < MIN_SCAN_LETTERS) {
                    problems.push(`content/apps.json app ${i + 1}: ${field} "${value}" has under ${MIN_SCAN_LETTERS} letters, `
                        + 'too short to scan for safely while the apps are hidden; a person decides (rename it, or change the scan)');
                    continue;
                }
                phrase(group, value);
                phrase(group, spacedCamel(value));
            }
        });
        stringsIn(content('app-words.json')).forEach((s) => phrase(group, s));
        stringsIn(content('about-words.json').making ?? {}).forEach((s) => phrase(group, s));
        const site = content('site-words.json');
        [site.home?.appsTitle, site.home?.appsTitleNotAllOffGrid, site.offGrid?.legendOnAppPage, ...stringsIn(site.moreInTheWorks ?? {})]
            .filter((s) => typeof s === 'string').forEach((s) => phrase(group, s));
        CUT_WHILE_APPS_HIDDEN.forEach((s) => phrase(group, s));
        link(group, '/apps');
        label(group, 'Apps');
    }
    if (!settings.showContact) {
        const group = 'hidden Contact';
        stringsIn(content('about-words.json').contact ?? {}).forEach((s) => phrase(group, s));
        CONTACT_PAGE_WORDS.forEach((s) => phrase(group, s));
        link(group, '/contact');
        label(group, 'Contact');
    }
    DRAFT_LABEL_WORDS.forEach((s) => phrase('draft label', s));
    return { patterns, problems };
}

// Page text as a reader sees it: HTML entities decoded (&#x27; -> ') and the
// page data's escapes undone (\" -> "), so words match however they are stored.
function decoded(text) {
    return text
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\(["'\\/])/g, '$1')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, n) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[n]);
}

// Every match, with where it starts in the view and 30 characters each side.
function hitsIn(view, re) {
    re.lastIndex = 0;
    return [...view.matchAll(re)].map((m) => {
        const s = Math.max(0, m.index - 30);
        return { at: m.index, context: view.slice(s, m.index + m[0].length + 30).replace(/\s+/g, ' ') };
    });
}

// A page without its tags: each tag becomes one space, so words split by an
// inline tag (like a no-wrap span) read as words. from[i] is where character i
// of the plain text sits in the page, so a match found in both views can be
// told apart from a second match.
function withoutTags(text) {
    const parts = [];
    const from = [];
    let last = 0;
    for (const m of text.matchAll(/<[^>]*>/g)) {
        parts.push(text.slice(last, m.index), ' ');
        for (let i = last; i < m.index; i++) from.push(i);
        from.push(m.index);
        last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    for (let i = last; i < text.length; i++) from.push(i);
    return { plain: parts.join(''), from };
}

export function checkHiddenContent(outDir = OUT_DIR, root = ROOT) {
    const settings = readSiteSettings(root);
    const { patterns, problems } = hiddenPatterns(root, settings);
    const hits = [...settings.problems, ...problems];
    const all = walk(outDir);

    // No file of a hidden page at all: its page, or its page data.
    const hiddenFolders = SWITCHES.filter((s) => !settings[s.key]).map((s) => s.folder);
    for (const file of all) {
        const name = rel(outDir, file);
        const folder = hiddenFolders.find((f) => name.split(/[/.]/).includes(f));
        if (folder) hits.push(`hidden page file in out/: ${name}`);
    }

    // No hidden words, link or menu in any text file. A page is read twice:
    // with its tags (names in alt text, links in href) and without them (words
    // split by an inline tag, like a no-wrap span). The hits of BOTH views are
    // listed. A match both views find (same start in the page) is listed once,
    // with its tags; a second match with the same words around it is still
    // listed. A file that can't be read is listed, and the scan goes on.
    const files = all.filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
    for (const file of files) {
        const raw = readForScan(outDir, file, hits);
        if (raw === null) continue;
        const text = decoded(raw);
        const isHtml = path.extname(file).toLowerCase() === '.html';
        const plain = isHtml ? withoutTags(text) : null;
        for (const { name, re } of patterns) {
            const tagged = hitsIn(text, re);
            const taggedAt = new Set(tagged.map((h) => h.at));
            const untagged = plain === null ? [] : hitsIn(plain.plain, re).filter((h) => !taggedAt.has(plain.from[h.at]));
            for (const { context } of [...tagged, ...untagged]) hits.push(`${name} in ${rel(outDir, file)}: …${context}…`);
        }
    }
    return { ok: hits.length === 0, scanned: files.length, patterns: patterns.length, hits };
}
