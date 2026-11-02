// The box walk (BUWEB-114, Stanley's ruling 2.a). Run by box.config.mjs, in
// Chromium and WebKit at 390 and 1280 px. One walk per browser and size:
//   Home, About, Privacy and /no-such-page (each loaded, scrolled to the
//   bottom and back), one popup opened on Home, then a client-side move
//   Home -> About -> Home (the page is never reloaded: a marker on the window
//   survives).
// PASS = 0 Content-Security-Policy violations, 0 console errors apart from the
// intended 404 line, 0 failed requests and 0 requests to another host.
// Box mode only (E2E_BASE_URL set): every page's response carries the
// server's policy header with frame-ancestors 'none', and its script-src and
// style-src stay 'self' 'unsafe-inline' only (Stanley's rule iii). Both modes:
// every page carries its own policy meta tag (exactly one).
//
// Allowed, and counted in the report, never hidden:
//   - the 404 line: "Failed to load resource ... 404" for /no-such-page/
//     itself, the address that is meant to be missing;
//   - Next's prefetch HEADs (freddy-114-csp-check.md 2.b): Chromium reports a
//     HEAD that its own router cancels as net::ERR_ABORTED, even though the
//     server answered 200. One counts as allowed only when ALL of these hold:
//     it is a HEAD, to this site, failed with net::ERR_ABORTED, AND the server
//     answered it 200. A GET, another error, another host or no answer at all
//     is a real failure.
import { test, expect, PAGES, networkQuiet, scrollToY, settle } from '../support/site.mjs';
import { TRIGGER, expectOpen, popupsLive, press, tipOf } from '../support/offgrid.mjs';
import { ABOUT } from '../support/words.mjs';

const BOX = !!process.env.E2E_BASE_URL;
const MISSING = '/no-such-page/';
const CSP_NOTE = /content security policy|refused to (?:execute|apply|load|connect)/i;
const ONLY_SELF_INLINE = (name) => `${name} 'self' 'unsafe-inline'`;

const directive = (policy, name) => policy.split(';').map((d) => d.trim()).find((d) => d.split(/\s+/)[0] === name) ?? '';

test('the box walk: every page, one popup, a client-side move; no policy violation, console error, failed or outside request', async ({ page, baseURL, siteGuards }, testInfo) => {
    test.setTimeout(120_000);
    const origin = new URL(baseURL).origin;
    const missingURL = `${origin}${MISSING}`;
    const seen = { csp: [], console: [], intended404: [], failed: [], prefetchHeads: [], outside: [], http: [] };
    const answered = new Map();

    await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
            window.__csp.push(`${e.violatedDirective}: blocked ${e.blockedURI || 'inline'} at ${e.sourceFile || 'the page'}:${e.lineNumber}`);
        });
    });
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        const line = `${page.url()}: ${text}`;
        const is404Line = /^Failed to load resource/.test(text) && /\b404\b/.test(text);
        if (is404Line && (msg.location().url === missingURL || page.url() === missingURL)) seen.intended404.push(line);
        else seen.console.push(line);
    });
    page.on('request', (req) => {
        const url = req.url();
        if (!/^(?:data|blob|about):/.test(url) && new URL(url).origin !== origin) seen.outside.push(`${req.method()} ${url}`);
    });
    page.on('response', (res) => {
        answered.set(res.request(), res.status());
        const meant = res.status() === 404 && res.url() === missingURL;
        if (res.status() >= 400 && !meant) seen.http.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    });
    page.on('requestfailed', (req) => seen.failed.push(req));

    // Collects this document's violations (the record starts again on every full load).
    const collect = async (where) => {
        for (const v of await page.evaluate(() => window.__csp.splice(0))) seen.csp.push(`${where}: ${v}`);
    };

    const visit = async (path, status) => {
        const res = await page.goto(path);
        expect.soft(res?.status(), `${path}: status`).toBe(status);
        const metas = await page.locator('head meta[http-equiv="Content-Security-Policy"]').count();
        expect.soft(metas, `${path}: the page's own policy (meta tags; the build writes exactly one)`).toBe(1);
        if (BOX) {
            const header = res?.headers()['content-security-policy'] ?? '';
            expect.soft(header, `${path}: the server's Content-Security-Policy header has frame-ancestors 'none'`).toContain("frame-ancestors 'none'");
            for (const name of ['script-src', 'style-src']) {
                expect.soft(directive(header, name), `${path}: the header's ${name} is 'self' 'unsafe-inline' only (no hash, nonce or strict-dynamic)`)
                    .toBe(ONLY_SELF_INLINE(name));
            }
        }
        await settle(page);
        await scrollToY(page, 100000);
        await scrollToY(page, 0);
        await networkQuiet(page);
        await collect(path);
    };

    // 1. Every page, and the missing one.
    for (const p of PAGES) await visit(p, 200);
    await visit(MISSING, 404);

    // 2. One popup, on Home: the hero word.
    await visit('/', 200);
    await popupsLive(page);
    const hero = page.locator(`h1 ${TRIGGER}`);
    const tip = await tipOf(page, hero);
    await press(hero, testInfo);
    await expectOpen(hero, tip, 'the hero word\'s popup');
    await page.keyboard.press('Escape');
    // 3. A client-side move, Home -> About -> Home. About is parked (one-page site, 2026-11-02): runs only when the header has the About link.
    if (await page.getByRole('navigation', { name: 'Main' }).count() > 0) {
    await page.evaluate(() => { window.__boxStayed = true; });
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/about/`);
    await expect(page.locator('h1')).toHaveText(ABOUT.title);
    expect.soft(await page.evaluate(() => window.__boxStayed), 'Home -> About stayed on the client (no reload)').toBe(true);
    await networkQuiet(page);
    // The home link wraps the logo; its own box is empty, so click the logo.
    await page.locator('header a[href="/"] [data-logo="mark"]').click();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(hero).toHaveCount(1);
    expect.soft(await page.evaluate(() => window.__boxStayed), 'About -> Home stayed on the client (no reload)').toBe(true);
    await networkQuiet(page);
    await collect('Home -> About -> Home');
    }

    // 4. Sort the failed requests: Next's cancelled prefetch HEADs, or real.
    const real = [];
    for (const req of seen.failed) {
        const why = req.failure()?.errorText ?? 'no reason given';
        const status = answered.get(req);
        const line = `${req.method()} ${req.url()}: ${why} (${status === undefined ? 'no answer' : `answered ${status}`})`;
        const prefetchHead = req.method() === 'HEAD' && new URL(req.url()).origin === origin && /ERR_ABORTED/.test(why) && status === 200;
        (prefetchHead ? seen.prefetchHeads : real).push(line);
    }

    const summary = `${testInfo.project.name}: ${seen.csp.length} policy violations, ${seen.console.length} console errors, `
        + `${real.length} failed requests, ${seen.outside.length} outside requests, ${seen.http.length} HTTP errors; `
        + `allowed: ${seen.intended404.length} intended 404 line(s), ${seen.prefetchHeads.length} cancelled prefetch HEAD(s)`;
    testInfo.annotations.push({ type: 'box', description: summary });
    console.log(summary);

    expect.soft(seen.csp, 'Content-Security-Policy violations').toEqual([]);
    expect.soft(seen.console, 'console errors (other than the intended 404 line)').toEqual([]);
    expect.soft(real, 'failed requests (other than Next\'s cancelled prefetch HEADs that were answered 200)').toEqual([]);
    expect.soft(seen.outside, 'requests to another host').toEqual([]);
    expect.soft(seen.http, 'HTTP errors (other than the missing page\'s own 404)').toEqual([]);

    // 5. Control: an inline script added after load must be blocked AND
    // recorded. With no policy live, or a blind recorder, this fails.
    await page.evaluate(() => {
        const s = document.createElement('script');
        s.textContent = 'window.__ranInline = true';
        document.head.append(s);
    });
    await expect.poll(() => page.evaluate(() => window.__csp.length), 'the recorder sees a made-up violation').toBeGreaterThan(0);
    expect.soft(await page.evaluate(() => window.__ranInline), 'the made-up inline script ran').toBeUndefined();
    // The made-up violation also reaches the console; only this control's line is excused.
    siteGuards.jsErrors.splice(0, siteGuards.jsErrors.length, ...siteGuards.jsErrors.filter((m) => !CSP_NOTE.test(m)));
});
