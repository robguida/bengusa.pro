// Release 1 (BUWEB-114): the real site with the apps and Contact hidden.
// Checks on the build in out/, no browser. Every scan reports EVERY hit (soft
// checks, Rob's loop rule), and each one has a made-up-bad-string test next to
// it, so a check that cannot fail is caught here.
//   - hidden = NOT built (Quinn ruling 1): no app name, no link, no page, no file
//   - no draft label, no form, no inline style or script handler
//   - Privacy is built and linked from every footer
//   - nothing from an outside host; fonts come from out/
//   - "Rabbi", "Saikat" and "Fojle" never alone, across the WHOLE build
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { BUILD_LOG, OUT_DIR, ROOT, checkRouteTable, expectedRoutes, rel, walk } from '../../scripts/lib/export-checks.mjs';
import {
    CONTACT_TERMS, DRAFT_TERMS, INLINE_TERMS, OUTSIDE_HOSTS, appTerms, asLinks, badCssUrls, badHrefs, bareNames, hiddenFileHits, outTexts, termHits,
} from '../support/release1-scan.mjs';
import { SETTINGS_FILE, SETTINGS_PROBLEMS, SHOW } from '../support/settings.mjs';
import { APPS } from '../support/words.mjs';

const HIDDEN = 'the apps and Contact are shown: Release 1\'s hidden-page checks do not apply';
const SLUGS = APPS.map((a) => a.page.replace(/^\/apps\//, '').replace(/\/$/, ''));

const scanAll = (files, terms) => files.flatMap((f) => termHits(f.file, f.text, terms));

test.describe('Release 1: the settings and the parked code', () => {
    test('content/site-settings.json reads with no problem and hides the apps and Contact', () => {
        // readSiteSettings() lists a missing file, bad JSON, a missing switch or a non-true/false value.
        expect.soft(SETTINGS_PROBLEMS, `${SETTINGS_FILE}: problems found by readSiteSettings()`).toEqual([]);
        // Release 1 ships with both hidden. When the apps-return ticket turns them on, it changes this line.
        expect.soft(SHOW.apps, 'Release 1: showApps is false').toBe(false);
        expect.soft(SHOW.contact, 'Release 1: showContact is false').toBe(false);
    });

    // A new page or a new file route is a reviewed change: it fails here until
    // this list is updated with it.
    test('the pages are exactly /, /about and /privacy; the route table adds only the 404 and the three files Next makes from src/app', () => {
        test.skip(SHOW.apps || SHOW.contact, HIDDEN);
        expect.soft(expectedRoutes(), 'expectedRoutes(): the pages the build must make').toEqual(['/', '/about', '/privacy']);
        expect(fs.existsSync(BUILD_LOG), `no build log at ${BUILD_LOG}: run "npm run build" first`).toBe(true);
        const rows = checkRouteTable(fs.readFileSync(BUILD_LOG, 'utf8')).rows.map((r) => r.route).sort();
        expect.soft(rows, 'route-table rows').toEqual(['/', '/_not-found', '/about', '/apple-icon.png', '/icon.svg', '/privacy', '/robots.txt']);
    });

    test('the hidden code is kept: the app pages and Contact sit in src/app/_parked/, not in routing', () => {
        test.skip(SHOW.apps && SHOW.contact, HIDDEN);
        const exists = (...p) => fs.existsSync(path.join(ROOT, 'app', ...p));
        if (!SHOW.apps) {
            expect.soft(exists('_parked', 'apps'), 'src/app/_parked/apps kept').toBe(true);
            expect.soft(exists('apps'), 'src/app/apps is out of routing').toBe(false);
        }
        if (!SHOW.contact) {
            expect.soft(exists('_parked', 'contact'), 'src/app/_parked/contact kept').toBe(true);
            expect.soft(exists('contact'), 'src/app/contact is out of routing').toBe(false);
        }
    });
});

test.describe('Release 1: hidden means not built', () => {
    let texts;
    let files;
    test.beforeAll(() => {
        texts = outTexts();
        files = walk(OUT_DIR).map((f) => rel(OUT_DIR, f));
    });

    test('no app name, short name, slug or ID anywhere in out/ (every text file)', () => {
        test.skip(SHOW.apps, HIDDEN);
        expect(texts.length, 'text files scanned').toBeGreaterThan(10);
        expect.soft(scanAll(texts, appTerms()), 'app names, slugs, IDs or /apps paths in out/').toEqual([]);
    });

    test('the app-name scan catches made-up bad lines, and passes plain ones', () => {
        const caught = [
            'We made TimeTracker', 'time tracker app', 'Time-Tracker', 'Vault (working name)', 'VAULT', 'catche finds photos',
            'href="/apps/time-tracking/"', '"/apps"', 'password-manager', 'photo-search', 'TIMETRACKER',
        ];
        for (const s of caught) expect.soft(termHits('t', s, appTerms()).length, `should catch: ${s}`).toBeGreaterThan(0);
        const fine = ['Makers of Off-grid apps.', 'Apps that mind their own business.', 'Now we\'re making apps for you.', 'We call Off-grid apps Cloud-killers.'];
        for (const s of fine) expect.soft(termHits('t', s, appTerms()), `should pass: ${s}`).toEqual([]);
    });

    test('no link to a hidden page: every href in every page reaches a shown page or a file in out/', () => {
        const shown = asLinks(expectedRoutes());
        const pages = texts.filter((t) => t.file.endsWith('.html'));
        expect(pages.length, 'html files scanned').toBeGreaterThan(2);
        expect.soft(pages.flatMap((p) => badHrefs(p.file, p.text, shown)), 'links to nowhere or to hidden pages').toEqual([]);
        if (!SHOW.contact) expect.soft(scanAll(texts, CONTACT_TERMS), 'a path to /contact anywhere in out/').toEqual([]);
    });

    test('the link scan catches made-up bad links', () => {
        const shown = ['/', '/about/', '/privacy/'];
        const bad = ['<a href="/contact/">', '<a href="/apps/vault/">', '<a href="mailto:a@b.co">', '<a href="https://example.com/">', '<a href="//cdn.example/x.js">', '<a href="/missing-page/">'];
        for (const s of bad) expect.soft(badHrefs('t.html', s, shown).length, `should catch: ${s}`).toBeGreaterThan(0);
        for (const s of ['<a href="/about/">', '<a href="/">', '<a href="#top">', '<a href="/about/#x">']) {
            expect.soft(badHrefs('t.html', s, shown), `should pass: ${s}`).toEqual([]);
        }
        expect.soft(termHits('t', '<a href="/contact/">', CONTACT_TERMS).length, 'the /contact path scan').toBeGreaterThan(0);
    });

    test('the one approved outside link (https://bengusa.pro/ourusdebt/, BUWEB-128) passes the link scan; every other address, and any look-alike, is still caught', () => {
        const shown = ['/', '/about/', '/privacy/'];
        expect.soft(badHrefs('t.html', '<a href="https://bengusa.pro/ourusdebt/">', shown), 'the approved link').toEqual([]);
        for (const s of ['<a href="https://bengusa.pro/ourusdebt">', '<a href="http://bengusa.pro/ourusdebt/">', '<a href="https://bengusa.pro.example.com/ourusdebt/">',
            '<a href="https://www.bengusa.pro/ourusdebt/">', '<a href="https://bengusa.pro/ourusdebt/x">', '<a href="https://usdebt.bengusa.pro">', '<a href="https://evil.example/https://bengusa.pro/ourusdebt/">']) {
            expect.soft(badHrefs('t.html', s, shown).length, `should still catch: ${s}`).toBeGreaterThan(0);
        }
    });

    test('nothing is built for a hidden page: no apps/ or contact/ folder, no page-data or chunk file for them, no route-table row', () => {
        test.skip(SHOW.apps && SHOW.contact, HIDDEN);
        expect.soft(hiddenFileHits(files, SHOW.apps ? [] : SLUGS), 'files in out/ for hidden pages').toEqual([]);
        expect(fs.existsSync(BUILD_LOG), `no build log at ${BUILD_LOG}: run "npm run build" first`).toBe(true);
        const rows = checkRouteTable(fs.readFileSync(BUILD_LOG, 'utf8')).rows.map((r) => r.route);
        const hidden = rows.filter((r) => (!SHOW.apps && r.startsWith('/apps')) || (!SHOW.contact && r.startsWith('/contact')));
        expect.soft(hidden, 'route-table rows for hidden pages').toEqual([]);
    });

    test('the file scan catches made-up bad paths', () => {
        const bad = ['apps/photo-search/index.html', 'contact/index.html', 'contact.html', '__next.apps.txt', '__next.contact.__PAGE__.txt', '_next/static/chunks/contact-ab12.js', 'x/time-tracking.txt'];
        for (const f of bad) expect.soft(hiddenFileHits([f], SLUGS).length, `should catch: ${f}`).toBeGreaterThan(0);
        for (const f of ['about/index.html', 'index.html', '_next/static/chunks/app_page-ab12.js', 'privacy/index.html', '404.html']) {
            expect.soft(hiddenFileHits([f], SLUGS), `should pass: ${f}`).toEqual([]);
        }
    });
});

test.describe('Release 1: no draft words, no forms, nothing inline', () => {
    let texts;
    test.beforeAll(() => { texts = outTexts(); });

    test('"Draft words. Not final." is nowhere in out/', () => {
        expect.soft(scanAll(texts, DRAFT_TERMS), 'draft label text in out/').toEqual([]);
    });

    test('the draft-words scan catches made-up bad lines', () => {
        for (const s of ['Draft words. Not final.', 'draft words', 'NOT FINAL', '"Not final."']) {
            expect.soft(termHits('t', s, DRAFT_TERMS).length, `should catch: ${s}`).toBeGreaterThan(0);
        }
        expect.soft(termHits('t', 'The final word is ours.', DRAFT_TERMS), 'plain line').toEqual([]);
    });

    test('no page holds a form, a field or a button that sends anything (the Privacy page says the site has no sign-up or contact forms; Our U.S. Debt\x27s chart pickers are not in out/)', () => {
        const pages = texts.filter((t) => t.file.endsWith('.html'));
        expect.soft(pages.flatMap((p) => termHits(p.file, p.text, [{ label: 'a form control', re: /<(?:form|input|textarea|select)\b/gi }])), 'form controls in out/').toEqual([]);
    });

    test('no inline <style>, style="" attribute, event handler or javascript: link in any page (the CSP allows none)', () => {
        const pages = texts.filter((t) => t.file.endsWith('.html'));
        expect(pages.length, 'html files scanned').toBeGreaterThan(2);
        expect.soft(scanAll(pages, INLINE_TERMS), 'inline style or script handlers').toEqual([]);
    });

    test('the inline scan catches made-up bad lines', () => {
        for (const s of ['<style>a{}</style>', '<div style="color:red">', '<a onclick="x()">', '<a href="javascript:void(0)">']) {
            expect.soft(scanAll([{ file: 't', text: s }], INLINE_TERMS).length, `should catch: ${s}`).toBeGreaterThan(0);
        }
        expect.soft(scanAll([{ file: 't', text: '<div class="x" data-style-name="y"><a href="/about/">' }], INLINE_TERMS), 'plain markup').toEqual([]);
    });
});

// About is its own live page again (BUWEB-133); Privacy is live (BUWEB-125). Their tests are below.
test.describe('About is built and linked; the 404 page sends other addresses Home', () => {
    test('out/about/index.html exists, and Home links to /about/ in the header and the footer', () => {
        expect.soft(fs.existsSync(path.join(OUT_DIR, 'about', 'index.html')), 'out/about/index.html').toBe(true);
        const hrefs = fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf8').match(/href="\/about\/"/g) ?? [];
        expect.soft(hrefs.length, 'links to /about/ on Home (header and footer)').toBe(2);
    });
    test('out/404.html refreshes to / at once (a meta refresh), has a "Go to the home page" link and no inline script', () => {
        const html = fs.readFileSync(path.join(OUT_DIR, '404.html'), 'utf8');
        expect.soft(html, 'meta refresh').toMatch(/<meta http-equiv="refresh" content="0;url=\/"\s*\/?>/);
        expect.soft(html, 'fallback link').toMatch(/<a [^>]*href="\/"[^>]*>Go to the home page<\/a>/);
    });
});

test.describe('Privacy is built and linked from every footer (live again, BUWEB-125)', () => {
    test('out/privacy/index.html exists, has the heading "Privacy" and not the old placeholder', () => {
        const file = path.join(OUT_DIR, 'privacy', 'index.html');
        expect(fs.existsSync(file), 'out/privacy/index.html').toBe(true);
        const html = fs.readFileSync(file, 'utf8');
        expect.soft(html, 'an h1 "Privacy"').toMatch(/<h1[^>]*>\s*Privacy\s*<\/h1>/);
        expect.soft(html, 'the old placeholder').not.toMatch(/being written|Coming in a later/i);
    });

    test('every page in out/ (the 404 page too) has a footer that links to /privacy/', () => {
        const pages = walk(OUT_DIR).filter((f) => f.endsWith('.html') && !rel(OUT_DIR, f).startsWith('_next/'));
        expect(pages.length, 'html pages').toBeGreaterThan(2);
        const without = [];
        for (const full of pages) {
            const html = fs.readFileSync(full, 'utf8');
            const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? '';
            if (!/href="\/privacy\/"/.test(footer)) without.push(rel(OUT_DIR, full));
        }
        expect.soft(without, 'pages whose footer has no Privacy link').toEqual([]);
    });
});

test.describe('Release 1: nothing from an outside host', () => {
    let texts;
    test.beforeAll(() => { texts = outTexts(); });

    test('no analytics, CDN, tracker or font host named anywhere in out/', () => {
        expect.soft(scanAll(texts, OUTSIDE_HOSTS), 'outside hosts in out/').toEqual([]);
    });

    test('the host scan catches made-up bad lines', () => {
        for (const s of ['https://www.googletagmanager.com/gtag/js', 'cdn.jsdelivr.net/npm/x', 'unpkg.com/react', 'fonts.gstatic.com', 'GOOGLE-ANALYTICS.COM', 'cdnjs.cloudflare.com/ajax']) {
            expect.soft(termHits('t', s, OUTSIDE_HOSTS).length, `should catch: ${s}`).toBeGreaterThan(0);
        }
        expect.soft(termHits('t', 'Every file, fonts included, comes from our server.', OUTSIDE_HOSTS), 'plain line').toEqual([]);
    });

    test('every font and every url() in the CSS is a file in out/ (fonts load from our own server)', () => {
        const css = walk(OUT_DIR).filter((f) => f.endsWith('.css'));
        expect(css.length, 'css files').toBeGreaterThan(0);
        const urls = [];
        const hits = css.flatMap((full) => {
            const text = fs.readFileSync(full, 'utf8');
            for (const m of text.matchAll(/url\(\s*["']?([^)"']+)/g)) urls.push(m[1]);
            return badCssUrls(rel(OUT_DIR, full), text);
        });
        expect(urls.filter((u) => /\.woff2?(?:[?#]|$)/i.test(u)).length, 'font files the CSS names').toBeGreaterThan(0);
        expect.soft(hits, 'CSS urls that leave out/ or point at nothing').toEqual([]);
    });

    test('the CSS url scan catches made-up bad urls', () => {
        for (const s of ['a{src:url(https://fonts.example/x.woff2)}', 'a{src:url(//cdn.example/x.woff2)}', 'a{src:url(/missing/font.woff2)}']) {
            expect.soft(badCssUrls('_next/static/x.css', s).length, `should catch: ${s}`).toBeGreaterThan(0);
        }
        expect.soft(badCssUrls('_next/static/x.css', 'a{background:url(data:image/png;base64,AAAA)}'), 'data: url').toEqual([]);
    });
});

test.describe('Release 1: "Rabbi", "Saikat" and "Fojle" never alone, anywhere in the build', () => {
    test('every text file in out/ and every file name holds them only inside the full name', () => {
        const hits = [
            ...outTexts().flatMap((f) => bareNames(`out/${f.file}`, f.text)),
            ...walk(OUT_DIR).flatMap((full) => bareNames('file name', rel(OUT_DIR, full))),
            ...walk(path.join(ROOT, 'public')).flatMap((full) => bareNames('public file name', rel(path.join(ROOT, 'public'), full))),
        ];
        expect.soft(hits, 'a bare "Rabbi", "Saikat" or "Fojle" in the build').toEqual([]);
    });

    test('the name scan catches made-up bad lines, and passes the full name', () => {
        for (const s of ['Rabbi built it', 'by saikat', '"id":"SAIKAT"', 'Fojle said hi', '/images/about/rabbi.webp', 'fojle-saikat.webp', 'Fojle Rabbi', 'Rabbi Saikat']) {
            expect.soft(bareNames('t', s).length, `should catch: ${s}`).toBeGreaterThan(0);
        }
        for (const s of ['Fojle Rabbi Saikat, in glasses', '/images/about/fojle-rabbi-saikat.webp', '"fojle-rabbi-saikat"']) {
            expect.soft(bareNames('t', s), `should pass: ${s}`).toEqual([]);
        }
    });
});
