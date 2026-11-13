// The build's own guards can fail (Cody's BUWEB-114 review, MINOR 3 and 4).
// scripts/build.mjs and scripts/release/package.mjs trust these checks; a
// check that has gone silent would pass every build. So each one is called
// here on a throwaway folder with a planted bad input, and must answer
// ok: false with the hit named:
//   - readSiteSettings / checkSiteSettings: the one reader of the site switch;
//   - checkSettingsMatchFolders: the switch and the page folders agree;
//   - checkPublicAllowlist: every file in public/ is on the list, and back;
//   - checkRouteTable: a hidden page in the route table;
//   - checkHiddenContent: hidden words seen only with the tags, and only
//     without them, are BOTH listed; a short app name is a problem;
//   - checkGuardedFields: the scan goes on past a file it can't read;
//   - injectCsp / checkCsp: an upper-case <SCRIPT> before the policy, no
//     <head> before the charset, a page that can't be read.
// Rob's loop rule: two bad inputs give two hits, and a file that can't be read
// is listed while the scan goes on to the next file.
//
// The made-up app ("Quillmoth") and its words are not the site's. Nothing
// here reads or writes the real content/, public/ or out/.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
    MIN_SCAN_LETTERS, ROOT, checkGuardedFields, checkHiddenContent, checkPublicAllowlist, checkRouteTable, checkSettingsMatchFolders,
    readSiteSettings, walk,
} from '../../scripts/lib/export-checks.mjs';
import { scanOut } from '../support/content-scan.mjs';
import { checkCsp, injectCsp, policyFor, scriptHash } from '../../scripts/lib/csp.mjs';
import { checkSiteSettings } from '../../src/lib/site-settings.mjs';

const SETTINGS = 'content/site-settings.json';
const HIDDEN = { showApps: false, showContact: false };
// The "Our U.S. Debt" block switch (BUWEB-128) sits beside the two page switches. It is on in every made-up
// site here unless a test says otherwise, so the tests of the page switches stay about the page switches.
const PROMO = { showUsDebtPromo: true };
const ALL_HIDDEN = { ...HIDDEN, showUsDebtPromo: false };

// --- Throwaway folders ------------------------------------------------------
let made = [];
let restore = [];

function tempDir(label) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bengusa-guards-${label}-`));
    made.push(dir);
    return dir;
}

function put(root, rel, text) {
    const file = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
}

const json = (value) => `${JSON.stringify(value, null, 4)}\n`;

// A site root with the switch, the parked folders and a made-up app.
function siteRoot({ settings = { ...HIDDEN, ...PROMO }, noSettings = false, apps = [{ id: 'quillmoth', name: 'Quillmoth', shortName: 'Quillmoth', slug: 'quillmoth-notes', status: 'open' }] } = {}) {
    const root = tempDir('root');
    if (!noSettings) put(root, SETTINGS, typeof settings === 'string' ? settings : json(settings));
    put(root, 'content/apps.json', json(apps));
    put(root, 'content/app-words.json', json({}));
    put(root, 'content/about-words.json', json({}));
    put(root, 'content/site-words.json', json({}));
    put(root, 'app/_parked/apps/page.js', '// parked\n');
    put(root, 'app/_parked/contact/page.js', '// parked\n');
    return root;
}

// A page shaped like Next's: <head>, the charset, a stylesheet, a script file,
// then the body with one inline script.
const page = ({ head = '<head>', before = '', body = '<p>Hello.</p>' } = {}) => '<!DOCTYPE html><html lang="en">'
    + `${before}${head}<meta charSet="utf-8"/><link rel="stylesheet" href="/_next/static/a.css"/>`
    + '<script src="/_next/static/a.js" async=""></script></head>'
    + `<body>${body}<script>self.__next_f=self.__next_f||[]</script></body></html>`;

// --- A file this process can't read ------------------------------------------
// Windows: a deny-read rule for this user (icacls), removed afterwards.
// Linux / macOS: chmod 000. root reads anything, so there the case is skipped.
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

function makeUnreadable(file) {
    if (process.platform === 'win32') {
        const who = os.userInfo().username;
        execFileSync('icacls', [file, '/deny', `${who}:(R)`], { stdio: 'ignore' });
        restore.push(() => execFileSync('icacls', [file, '/remove:d', who], { stdio: 'ignore' }));
    } else {
        fs.chmodSync(file, 0o000);
        restore.push(() => fs.chmodSync(file, 0o644));
    }
    expect(() => fs.readFileSync(file), `${path.basename(file)} is unreadable for this test`).toThrow();
}

// The check walks the folder in the order the disk lists it, which differs by
// system. So the unreadable file is picked AFTER the walk: the first file the
// check will read is made unreadable, and the bad input goes in the next one.
// A check that stopped at the unreadable file would miss that bad input.
function walkOrder(dir, ext) {
    return walk(dir).filter((f) => !ext || path.extname(f) === ext);
}

test.afterEach(() => {
    for (const undo of restore.reverse()) {
        try { undo(); } catch { /* the folder is removed below either way */ }
    }
    restore = [];
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    made = [];
});

// --- The site switch -----------------------------------------------------------
test.describe('the site switch reader (one rule for site.js, the build checks and the tests)', () => {
    test('the committed file reads with no problem, and both switches are off for Release 1', () => {
        const s = readSiteSettings();
        expect.soft(s.problems, `${SETTINGS} problems`).toEqual([]);
        expect.soft({ showApps: s.showApps, showContact: s.showContact }).toEqual(HIDDEN);
        expect.soft(ROOT, 'the real root is never a throwaway folder').not.toContain('bengusa-guards-');
    });

    test('a missing switch is a problem, and that page counts as hidden', () => {
        const s = readSiteSettings(siteRoot({ settings: { showApps: true, ...PROMO } }));
        expect(s.problems).toEqual([`${SETTINGS}: "showContact" is missing (it must be true or false)`]);
        expect.soft(s.showContact, 'missing = hidden').toBe(false);
        expect.soft(s.showApps, 'true still shows').toBe(true);
    });

    test('a value that is not true or false is a problem, and counts as hidden ("false", 1, null)', () => {
        for (const bad of ['false', 'true', 1, null, {}]) {
            const s = readSiteSettings(siteRoot({ settings: { showApps: bad, showContact: false, ...PROMO } }));
            expect.soft(s.problems, `showApps: ${JSON.stringify(bad)}`).toEqual([`${SETTINGS}: "showApps" must be true or false`]);
            expect.soft(s.showApps, `showApps: ${JSON.stringify(bad)} counts as hidden`).toBe(false);
        }
    });

    test('two bad switches give two problems', () => {
        const s = readSiteSettings(siteRoot({ settings: { showApps: 'yes', ...PROMO } }));
        expect(s.problems).toEqual([
            `${SETTINGS}: "showApps" must be true or false`,
            `${SETTINGS}: "showContact" is missing (it must be true or false)`,
        ]);
        expect({ showApps: s.showApps, showContact: s.showContact }).toEqual(HIDDEN);
    });

    test('the "Our U.S. Debt" switch: true or false only; missing or any other value is a problem and counts as off (fail closed)', () => {
        const on = readSiteSettings(siteRoot());
        expect.soft(on.problems, 'a good file').toEqual([]);
        expect.soft(on.showUsDebtPromo, 'true shows the block').toBe(true);
        const missing = readSiteSettings(siteRoot({ settings: { ...HIDDEN } }));
        expect.soft(missing.problems, 'missing').toEqual([`${SETTINGS}: "showUsDebtPromo" is missing (it must be true or false)`]);
        expect.soft(missing.showUsDebtPromo, 'missing = off').toBe(false);
        for (const bad of ['true', 'false', 1, 0, null, {}, []]) {
            const s = readSiteSettings(siteRoot({ settings: { ...HIDDEN, showUsDebtPromo: bad } }));
            expect.soft(s.problems, `showUsDebtPromo: ${JSON.stringify(bad)}`).toEqual([`${SETTINGS}: "showUsDebtPromo" must be true or false`]);
            expect.soft(s.showUsDebtPromo, `showUsDebtPromo: ${JSON.stringify(bad)} counts as off`).toBe(false);
        }
        expect.soft(readSiteSettings(siteRoot({ settings: ALL_HIDDEN })).showUsDebtPromo, 'false').toBe(false);
    });

    test('a missing file, a file that is not JSON, or one that is not an object: a problem, and everything hidden', () => {
        const cases = [
            [siteRoot({ noSettings: true }), `${SETTINGS} is missing`],
            [siteRoot({ settings: '{"showApps": false,' }), `${SETTINGS} is not valid JSON:`],
            [siteRoot({ settings: '[]\n' }), `${SETTINGS} must hold one JSON object, like {"showApps": false}`],
            [siteRoot({ settings: 'true\n' }), `${SETTINGS} must hold one JSON object, like {"showApps": false}`],
        ];
        for (const [root, want] of cases) {
            const s = readSiteSettings(root);
            expect.soft(s.problems.length, `${want}: one problem`).toBe(1);
            expect.soft(s.problems[0] ?? '', want).toContain(want);
            expect.soft({ showApps: s.showApps, showContact: s.showContact }, `${want}: everything hidden`).toEqual(HIDDEN);
        }
    });

    test('checkSiteSettings (the pure rule) agrees: only true shows a page', () => {
        expect(checkSiteSettings({ showApps: true, showContact: true, showUsDebtPromo: true })).toEqual({ showApps: true, showContact: true, showUsDebtPromo: true, problems: [] });
        expect(checkSiteSettings(ALL_HIDDEN)).toEqual({ ...ALL_HIDDEN, problems: [] });
        expect(checkSiteSettings({ ...PROMO, showApps: 'true', showContact: true }).showApps).toBe(false);
        expect(checkSiteSettings({ ...HIDDEN, showUsDebtPromo: 'true' }).showUsDebtPromo).toBe(false);
    });
});

// --- Switch and folders -------------------------------------------------------
test.describe('checkSettingsMatchFolders', () => {
    test('passes when both pages are hidden and their code is parked (the control)', () => {
        expect(checkSettingsMatchFolders(siteRoot())).toEqual({ ok: true, problems: [] });
    });

    test('fails when a hidden page\'s folder is back in routing (Next would build it)', () => {
        const root = siteRoot();
        put(root, 'app/apps/page.js', '// live\n');
        const r = checkSettingsMatchFolders(root);
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([expect.stringContaining('the apps are hidden, but src/app/apps/ exists, so Next would build it')]);
    });

    test('two bad inputs give two problems: a hidden folder in routing, and hidden code that was not kept', () => {
        const root = siteRoot();
        put(root, 'app/apps/page.js', '// live\n');
        fs.rmSync(path.join(root, 'app', '_parked', 'contact'), { recursive: true });
        const r = checkSettingsMatchFolders(root);
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([
            expect.stringContaining('the apps are hidden, but src/app/apps/ exists'),
            expect.stringContaining('Contact is hidden, but the code is not in src/app/_parked/contact/'),
        ]);
    });

    test('a shown page whose folder is still parked fails', () => {
        const r = checkSettingsMatchFolders(siteRoot({ settings: { showApps: true, showContact: false, ...PROMO } }));
        expect(r.problems).toEqual([
            expect.stringContaining('the apps are shown, but src/app/apps/ is missing'),
            expect.stringContaining('the apps are shown, but src/app/_parked/apps/ still exists'),
        ]);
    });

    test('a broken switch is listed as well, and its page is treated as hidden', () => {
        const r = checkSettingsMatchFolders(siteRoot({ settings: { showApps: false, ...PROMO } }));
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([`${SETTINGS}: "showContact" is missing (it must be true or false)`]);
    });
});

// --- public/ allow-list -------------------------------------------------------
test.describe('checkPublicAllowlist', () => {
    // The list's path from the repo top. A throwaway folder has the repo's
    // shape: the list under tests/, public/ under src/ (the root the check gets).
    const LIST = 'tests/fixtures/public-allowlist.txt';
    const withPublic = (list, files) => {
        const repo = tempDir('public');
        put(repo, LIST, list);
        const root = path.join(repo, 'src');
        for (const f of files) put(root, `public/${f}`, 'x');
        return root;
    };

    test('passes when public/ holds exactly the listed files (the control; comments and blank lines ignored)', () => {
        const r = checkPublicAllowlist(withPublic('# kept\n\nimages/a.webp\r\nrobots-extra.txt\n', ['images/a.webp', 'robots-extra.txt']));
        expect(r).toEqual({ ok: true, problems: [], strays: [], missing: [] });
    });

    test('fails on a file in public/ the list does not name (it would be served)', () => {
        const r = checkPublicAllowlist(withPublic('images/a.webp\n', ['images/a.webp', 'images/raw-photo.jpg']));
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([`public/images/raw-photo.jpg is not on ${LIST} (it would be served): remove it, or add it to the list in a reviewed commit`]);
    });

    test('two bad inputs give two problems: a stray file and a listed file that is missing', () => {
        const r = checkPublicAllowlist(withPublic('images/a.webp\nimages/b.webp\n', ['images/a.webp', '.DS_Store']));
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([
            `public/.DS_Store is not on ${LIST} (it would be served): remove it, or add it to the list in a reviewed commit`,
            `public/images/b.webp is on ${LIST} but missing`,
        ]);
    });

    test('fails when the list itself is missing', () => {
        const root = path.join(tempDir('public'), 'src');
        put(root, 'public/a.txt', 'x');
        expect(checkPublicAllowlist(root).problems).toEqual([`${LIST} is missing`]);
    });
});

// --- Route table ---------------------------------------------------------------
test.describe('checkRouteTable: a hidden page in the route table', () => {
    const table = (...rows) => ['   ▲ Next.js', '', 'Route (app)', ...rows, '', '○  (Static)  prerendered as static content', ''].join('\n');
    const RELEASE1 = ['┌ ○ /', '├ ○ /_not-found', '├ ○ /about', '├ ○ /privacy', '└ ○ /robots.txt'];
    const WANTED = ['/', '/about', '/privacy'];
    const HIDDEN_ROUTES = ['/apps', '/contact'];

    test('passes on the Release 1 table (the control)', () => {
        const r = checkRouteTable(table(...RELEASE1), WANTED, HIDDEN_ROUTES);
        expect(r.problems).toEqual([]);
        expect(r.ok).toBe(true);
    });

    test('fails when a hidden page is built, even as a static page', () => {
        const r = checkRouteTable(table('┌ ○ /', '├ ○ /about', '├ ○ /contact', '└ ○ /privacy'), WANTED, HIDDEN_ROUTES);
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([`hidden page built: /contact (${SETTINGS} hides /contact)`]);
    });

    test('two bad inputs give two hits: a page under a hidden route, and the hidden route itself', () => {
        const r = checkRouteTable(table('┌ ○ /', '├ ○ /about', '├ ○ /apps', '├ ○ /apps/quillmoth-notes', '└ ○ /privacy'), WANTED, HIDDEN_ROUTES);
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([
            `hidden page built: /apps (${SETTINGS} hides /apps)`,
            `hidden page built: /apps/quillmoth-notes (${SETTINGS} hides /apps)`,
        ]);
    });

    test('a route that only starts with the same letters is not hidden (/appsx, /contacts)', () => {
        const r = checkRouteTable(table('┌ ○ /', '├ ○ /about', '├ ○ /appsx', '├ ○ /contacts', '└ ○ /privacy'), WANTED, HIDDEN_ROUTES);
        expect(r.problems).toEqual([]);
    });
});

// --- Hidden content -----------------------------------------------------------
test.describe('checkHiddenContent', () => {
    const out = (files) => {
        const dir = tempDir('out');
        for (const [rel, text] of Object.entries(files)) put(dir, rel, text);
        return dir;
    };

    test('passes on a clean page (the control)', () => {
        const r = checkHiddenContent(out({ 'index.html': page({ body: '<h1>Makers of Off-grid apps.</h1><p>Apps that mind their own business.</p>' }) }), siteRoot());
        expect(r.hits).toEqual([]);
        expect(r.ok).toBe(true);
    });

    test('lists BOTH a hit seen only with the tags (alt text) and one seen only without them (split by a span)', () => {
        const body = '<img alt="Quillmoth" src="/a.webp"/><p>Draft <span class="nw">words</span> here.</p>';
        const r = checkHiddenContent(out({ 'index.html': page({ body }) }), siteRoot());
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([
            // Named after the first field read, the app's id.
            expect.stringMatching(/^hidden apps: "quillmoth" in index\.html: .*alt="Quillmoth"/),
            expect.stringMatching(/^draft label: "Draft words" in index\.html: .*Draft\s+words/),
        ]);
    });

    // Cody's MINOR 1: per phrase, the old scan kept only the view with more
    // hits, so the same phrase seen once only with the tags and once only
    // without them gave one hit, not two.
    test('the SAME phrase, once in alt text and once split by a span, gives two hits (one per view)', () => {
        const body = '<img alt="Draft words" src="/a.webp"/><p>Draft <span class="nw">words</span> here.</p>';
        const r = checkHiddenContent(out({ 'index.html': page({ body }) }), siteRoot());
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([
            expect.stringMatching(/^draft label: "Draft words" in index\.html: .*alt="Draft words"/),
            expect.stringMatching(/^draft label: "Draft words" in index\.html: .*Draft words here\./),
        ]);
    });

    test('one match that both views see is listed once; two real matches with the same words around them are both listed', () => {
        const once = checkHiddenContent(out({ 'index.html': page({ body: '<p>We made Quillmoth.</p>' }) }), siteRoot());
        expect(once.hits).toEqual([expect.stringContaining('hidden apps: "quillmoth" in index.html')]);
        const twice = checkHiddenContent(out({ 'index.html': page({ body: '<p>Quillmoth</p><p>Quillmoth</p>' }) }), siteRoot());
        expect(twice.hits).toHaveLength(2);
    });

    test('two bad inputs in two files give two hits (a page, and page data)', () => {
        const r = checkHiddenContent(out({
            'notes/index.html': page({ body: '<p>Not final.</p>' }),
            'index.txt': '1:["$","a",null,{"href":"/notes/","children":"Contact"}]\n',
        }), siteRoot());
        expect(r.ok).toBe(false);
        expect(r.hits).toHaveLength(2);
        expect(r.hits.filter((h) => h.startsWith('draft label: "Not final" in notes/index.html: '))).toHaveLength(1);
        expect(r.hits.filter((h) => h.startsWith('hidden Contact: a "Contact" menu or link in index.txt: '))).toHaveLength(1);
    });

    test('a link to a hidden page is a hit, in a page and in page data', () => {
        const r = checkHiddenContent(out({
            'notes/index.html': page({ body: '<a href="/contact/">Hello</a>' }),
            'index.txt': '1:["$","a",null,{"href":"/apps"}]\n',
        }), siteRoot());
        expect(r.hits).toHaveLength(2);
        expect(r.hits.filter((h) => h.startsWith('hidden Contact: a link to /contact/ in notes/index.html: '))).toHaveLength(1);
        expect(r.hits.filter((h) => h.startsWith('hidden apps: a link to /apps/ in index.txt: '))).toHaveLength(1);
    });

    test('a file that can\'t be read is listed, and the scan goes on to the next file', () => {
        test.skip(isRoot, 'root reads every file, so no file can be made unreadable');
        const dir = out({ 'a.html': page(), 'b.html': page() });
        const [first, second] = walkOrder(dir, '.html');
        fs.writeFileSync(second, page({ body: '<p>Not final.</p>' }));
        makeUnreadable(first);
        const r = checkHiddenContent(dir, siteRoot());
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([
            expect.stringMatching(new RegExp(`^${path.basename(first).replace('.', '\\.')}: could not read: `)),
            expect.stringContaining(`draft label: "Not final" in ${path.basename(second)}`),
        ]);
    });

    test(`an app ID, name, short name or slug under ${MIN_SCAN_LETTERS} letters is a problem, not a silent skip`, () => {
        const short = siteRoot({ apps: [{ id: 'quillmoth', name: 'Qmx', shortName: 'Quillmoth', slug: 'quillmoth-notes', status: 'open' }] });
        const r = checkHiddenContent(out({ 'index.html': page() }), short);
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([`content/apps.json app 1: name "Qmx" has under ${MIN_SCAN_LETTERS} letters, `
            + 'too short to scan for safely while the apps are hidden; a person decides (rename it, or change the scan)']);
    });

    test('two short app fields give two problems; a short name is fine while the apps are shown', () => {
        const apps = [{ id: 'qm', name: 'Quillmoth', shortName: 'Q-M', slug: 'quillmoth-notes', status: 'open' }];
        const hidden = checkHiddenContent(out({ 'index.html': page() }), siteRoot({ apps }));
        expect(hidden.hits).toEqual([
            expect.stringContaining('content/apps.json app 1: id "qm" has under'),
            expect.stringContaining('content/apps.json app 1: shortName "Q-M" has under'),
        ]);
        const shown = checkHiddenContent(out({ 'index.html': page() }), siteRoot({ apps, settings: { showApps: true, showContact: false, ...PROMO } }));
        expect(shown.hits).toEqual([]);
    });

    test('a broken switch alone fails the check, listed first, before any file hit', () => {
        const r = checkHiddenContent(out({ 'index.html': page({ body: '<p>Draft words</p>' }) }), siteRoot({ settings: { showApps: false, ...PROMO } }));
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([
            `${SETTINGS}: "showContact" is missing (it must be true or false)`,
            expect.stringContaining('draft label: "Draft words" in index.html'),
        ]);
    });

    test('a hidden page\'s own file in out/ is a hit', () => {
        const r = checkHiddenContent(out({ 'index.html': page(), 'contact/index.html': page() }), siteRoot());
        expect(r.hits).toEqual(['hidden page file in out/: contact/index.html']);
    });
});

// --- Guarded fields ------------------------------------------------------------
test.describe('checkGuardedFields', () => {
    test('a file that can\'t be read is listed, and the scan goes on to the next file', () => {
        test.skip(isRoot, 'root reads every file, so no file can be made unreadable');
        const dir = tempDir('out');
        put(dir, 'a.txt', 'clean\n');
        put(dir, 'b.txt', 'clean\n');
        const [first, second] = walkOrder(dir, '.txt');
        fs.writeFileSync(second, '{"freeBeta":true}\n');
        makeUnreadable(first);
        const r = checkGuardedFields(dir, []);
        expect(r.ok).toBe(false);
        expect(r.hits).toEqual([
            expect.stringMatching(new RegExp(`^${path.basename(first).replace('.', '\\.')}: could not read: `)),
            expect.stringContaining(`freeBeta in ${path.basename(second)}`),
        ]);
    });
});

// --- The page policy (CSP) -----------------------------------------------------
test.describe('injectCsp and checkCsp', () => {
    const outWith = (pages) => {
        const dir = tempDir('csp');
        for (const [rel, html] of Object.entries(pages)) put(dir, rel, html);
        return dir;
    };
    const META = (html) => `<meta http-equiv="Content-Security-Policy" content="${policyFor([...new Set([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => scriptHash(m[1])))])}"/>`;
    // A page with its policy written in by hand, so a page injectCsp would
    // never write can be checked.
    const withMeta = (html) => html.replace('<meta charSet="utf-8"/>', (c) => `${c}${META(html)}`);

    test('injectCsp writes one policy right after the charset, and checkCsp passes it (the control)', () => {
        const dir = outWith({ 'index.html': page(), 'notes/index.html': page() });
        expect(injectCsp(dir)).toEqual({ ok: true, pages: 2, problems: [] });
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        expect(html).toContain(`<head><meta charSet="utf-8"/>${META(page())}<link`);
        expect(checkCsp(dir)).toEqual({ ok: true, pages: 2, problems: [] });
    });

    test('checkCsp: an UPPER-CASE <SCRIPT> before the policy fails (tags have no case in HTML)', () => {
        for (const tag of ['<SCRIPT src="/_next/static/x.js"></SCRIPT>', '<Script src="/x.js"></Script>', '<LINK rel="preload" href="/x.js"/>']) {
            const dir = outWith({ 'index.html': withMeta(page({ before: tag })) });
            const r = checkCsp(dir);
            expect.soft(r.ok, tag).toBe(false);
            expect.soft(r.problems, tag).toEqual([expect.stringMatching(/^index\.html: a <(script|link)> comes before the policy/)]);
        }
    });

    test('checkCsp: no <head> right before the charset fails (missing, <header>, or something in between)', () => {
        const cases = {
            'no head': page({ head: '' }),
            '<header>': page({ head: '<header>' }),
            '<title> first': page({ head: '<head><title>x</title>' }),
        };
        for (const [name, html] of Object.entries(cases)) {
            const r = checkCsp(outWith({ 'index.html': withMeta(html) }));
            expect.soft(r.ok, name).toBe(false);
            expect.soft(r.problems, name).toEqual(['index.html: <meta charSet="utf-8"/> is not right after <head>, so something comes before the policy']);
        }
        // <head lang="en"> is still a head.
        expect(checkCsp(outWith({ 'index.html': withMeta(page({ head: '<head lang="en">' })) })).problems).toEqual([]);
    });

    test('checkCsp: two bad pages give two problems, one each', () => {
        const r = checkCsp(outWith({
            'index.html': withMeta(page({ before: '<SCRIPT src="/x.js"></SCRIPT>' })),
            'privacy/index.html': withMeta(page({ head: '' })),
        }));
        expect(r.ok).toBe(false);
        expect(r.problems).toHaveLength(2);
        expect(r.problems.filter((p) => p.startsWith('index.html: a <script> comes before the policy'))).toHaveLength(1);
        expect(r.problems.filter((p) => p.startsWith('privacy/index.html: <meta charSet="utf-8"/> is not right after <head>'))).toHaveLength(1);
    });

    test('checkCsp: a page that can\'t be read is listed, and the next page is still checked', () => {
        test.skip(isRoot, 'root reads every file, so no file can be made unreadable');
        const dir = outWith({ '404.html': withMeta(page()), 'index.html': withMeta(page()) });
        const [first, second] = walkOrder(dir, '.html');
        // The next page's inline script no longer matches its policy's hash.
        fs.writeFileSync(second, fs.readFileSync(second, 'utf8').replace('self.__next_f||[]', 'self.__next_f||[1]'));
        makeUnreadable(first);
        const r = checkCsp(dir);
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual([
            expect.stringMatching(new RegExp(`^${path.basename(first).replace('.', '\\.')}: could not read: `)),
            expect.stringMatching(new RegExp(`^${path.basename(second).replace('.', '\\.')}: the policy does not match this page's inline scripts`)),
        ]);
    });

    test('injectCsp: two bad pages give two problems, a page it can\'t read is listed, and the good page still gets its policy', () => {
        test.skip(isRoot, 'root reads every file, so no file can be made unreadable');
        const dir = outWith({
            'a/index.html': page(),
            'b/index.html': page(),
            'twice/index.html': page().replace('<meta charSet="utf-8"/>', '<meta charSet="utf-8"/><meta charSet="utf-8"/>'),
            'has-one/index.html': withMeta(page()),
        });
        const [first, second] = walkOrder(dir, '.html').filter((f) => /[\\/][ab][\\/]/.test(f));
        makeUnreadable(first);
        const r = injectCsp(dir);
        expect(r.ok).toBe(false);
        expect(r.pages, 'pages that got a policy').toBe(1);
        expect(r.problems).toHaveLength(3);
        expect(r.problems).toEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(`^${path.basename(path.dirname(first))}/index\\.html: `)),
            'twice/index.html: expected one <meta charSet="utf-8"/>, found 2; no policy written',
            'has-one/index.html: already has a Content-Security-Policy meta tag; no policy written',
        ]));
        expect(fs.readFileSync(second, 'utf8'), 'the readable page after it got its policy').toContain('http-equiv="Content-Security-Policy"');
    });
});

// --- The outside-address scan (BUWEB-128) --------------------------------------
test.describe('scanOut: the one approved outside address', () => {
    const scan = (text) => {
        const dir = tempDir('scan');
        put(dir, 'index.html', `<!DOCTYPE html><html><body>${text}</body></html>`);
        return scanOut(dir).hits.outsideUrl;
    };

    test('https://bengusa.pro/ourusdebt/ (the Our U.S. Debt link) is allowed', () => {
        expect(scan('<a href="https://bengusa.pro/ourusdebt/">Try it</a>')).toEqual([]);
    });

    test('anything else is still an outside address: a look-alike host, another sub-domain, a path, plain http, another site', () => {
        for (const url of ['https://bengusa.pro/ourusdebt', 'https://bengusa.pro/ourusdebt/x', 'https://bengusa.pro.example.com/ourusdebt/', 'https://www.bengusa.pro/ourusdebt/', 'https://usdebt.bengusa.pro', 'http://bengusa.pro/ourusdebt/', 'https://example.com']) {
            expect.soft(scan(`<a href="${url}">x</a>`).length, `should catch ${url}`).toBe(1);
        }
    });
});
