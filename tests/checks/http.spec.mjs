// Plain HTTP checks against the served build (no browser).
import { test, expect } from '@playwright/test';
import { expectedRoutes } from '../../scripts/lib/export-checks.mjs';
import { readFixtureList } from '../support/fixtures.mjs';
import { SHOW } from '../support/settings.mjs';
import { APPS } from '../support/words.mjs';

const PAGES = expectedRoutes().map((r) => (r === '/' ? '/' : `${r}/`));
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

test.describe('pages and old addresses', () => {
    for (const page of PAGES) {
        test(`GET ${page} = 200, with the header and a title`, async ({ request }) => {
            const res = await request.get(page, { maxRedirects: 0 });
            expect(res.status()).toBe(200);
            const html = await res.text();
            expect(html).toContain('<html lang="en"');
            expect(html).toContain('data-logo="mark"');
            expect(html).toMatch(/<title>[^<]*bengUSA\.pro[^<]*<\/title>/);
        });
    }

    test('every address of the old site returns 404', async ({ request }) => {
        const old = readFixtureList('old-addresses.txt');
        expect(old.length).toBeGreaterThan(40);
        const notGone = [];
        for (const p of old) {
            const res = await request.get(encodePath(p), { maxRedirects: 0 });
            if (res.status() !== 404) notGone.push(`${p} = ${res.status()}`);
        }
        expect(notGone).toEqual([]);
    });

    test('Release 1: the hidden pages return 404 (no /contact/, no /apps/ or app page)', async ({ request }) => {
        test.skip(SHOW.apps && SHOW.contact, 'the apps and Contact are shown');
        const hidden = [
            ...(SHOW.contact ? [] : ['/contact/']),
            ...(SHOW.apps ? [] : ['/apps/', ...APPS.map((a) => a.page)]),
        ];
        const served = [];
        for (const p of hidden) {
            const res = await request.get(p, { maxRedirects: 0 });
            if (res.status() !== 404) served.push(`${p} = ${res.status()}`);
        }
        expect(served, 'hidden addresses that are served').toEqual([]);
    });

    test('Privacy returns 200 with its heading, no placeholder and no form', async ({ request }) => {
        const res = await request.get('/privacy/', { maxRedirects: 0 });
        expect(res.status()).toBe(200);
        const html = await res.text();
        expect.soft(html, 'h1 Privacy').toMatch(/<h1[^>]*>\s*Privacy\s*<\/h1>/);
        expect.soft(html, 'the old placeholder').not.toMatch(/being written/i);
        expect.soft(html, 'a form').not.toMatch(/<form\b/i);
    });

    test('robots.txt allows everything, names no sitemap and no outside address', async ({ request }) => {
        const res = await request.get('/robots.txt', { maxRedirects: 0 });
        expect(res.status(), '/robots.txt').toBe(200);
        const body = await res.text();
        expect.soft(body, 'User-agent line').toMatch(/^User-agent: \*\s*$/m);
        expect.soft(body, 'Allow line').toMatch(/^Allow: \/\s*$/m);
        expect.soft(body, 'a blanket Disallow').not.toMatch(/^Disallow:\s*\/\s*$/m);
        expect.soft(body, 'a sitemap line (the sitemap is not in Release 1)').not.toMatch(/^Sitemap:/mi);
        expect.soft(body, 'an outside address').not.toMatch(/https?:\/\//i);
    });

    test('an unknown address returns 404 with the site\'s not-found page', async ({ request }) => {
        const res = await request.get('/no-such-page/', { maxRedirects: 0 });
        expect(res.status()).toBe(404);
        expect(await res.text()).toContain('data-logo="mark"');
    });
});

test.describe('the static server (npm start)', () => {
    test('a page asked for without its slash redirects to the slash address', async ({ request }) => {
        const res = await request.get('/about', { maxRedirects: 0 });
        expect(res.status()).toBe(301);
        expect(res.headers().location).toBe('/about/');
    });

    test('only GET and HEAD are allowed', async ({ request }) => {
        expect((await request.post('/', { maxRedirects: 0 })).status()).toBe(405);
        expect((await request.head('/', { maxRedirects: 0 })).status()).toBe(200);
    });

    test('it never serves a file from outside out/', async ({ request }) => {
        for (const p of ['/..%2fpackage.json', '/%2e%2e/package.json', '/..%5cpackage.json', '/_next/..%2f..%2fpackage.json']) {
            expect((await request.get(p, { maxRedirects: 0 })).status(), p).toBe(404);
        }
    });
});
