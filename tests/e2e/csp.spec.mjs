// A Content-Security-Policy violation on any page fails the build (BUWEB-114,
// Freddy's plan section 2.d.iii). The policy is a <meta> tag the build writes
// into each page, with a hash for each inline script. A page whose hash is
// wrong, or that starts something the policy forbids, would break on the live
// site while every other test stayed green, because the test server sends no
// policy of its own.
//
// How: before any page script runs, a listener records every
// "securitypolicyviolation" event. Each page is loaded, scrolled (the header
// shrinks) and has every popup opened (they set style variables from script),
// then the record must be empty. A control proves the recorder can see one.
import { test, expect, PAGES, isReducedMotion, scrollToY, settle } from '../support/site.mjs';
import { TRIGGER, press } from '../support/offgrid.mjs';

const CSP_NOTE = /content security policy|refused to (?:execute|apply|load|connect)/i;

function recordViolations(page) {
    return page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
            window.__csp.push(`${e.violatedDirective}: blocked ${e.blockedURI || 'inline'} at ${e.sourceFile || 'the page'}:${e.lineNumber}`);
        });
    });
}

test.describe('Content-Security-Policy', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'the policy does not change with motion; the normal pass covers it');
    });

    test('no violation on any page, after scrolling and opening every popup', async ({ page, siteGuards }, testInfo) => {
        test.setTimeout(120_000);
        await recordViolations(page);
        // (Not the 404 page: it sends the visitor to Home at once by a meta refresh, so a browser
        // visit would be moved mid-test. The 404 page's policy is checked in the next test.)
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            await scrollToY(page, 100000);
            await scrollToY(page, 0);
            const triggers = page.locator(TRIGGER);
            const count = await triggers.count();
            for (let i = 0; i < count; i++) {
                const t = triggers.nth(i);
                await t.scrollIntoViewIfNeeded();
                await press(t, testInfo);
                await expect.soft(t, `${p}: popup ${i + 1} opens`).toHaveAttribute('data-state', 'open');
                await page.keyboard.press('Escape');
            }
            expect.soft(await page.evaluate(() => window.__csp), `${p}: Content-Security-Policy violations`).toEqual([]);
        }
        // The browser also logs each violation as a console error; the site guard
        // (support/site.mjs) turns any such line into a failure too, so none may remain.
        expect.soft(siteGuards.jsErrors.filter((m) => CSP_NOTE.test(m)), 'console lines about the policy').toEqual([]);
    });

    test('every page carries a policy that allows no inline script or eval (and the recorder can see a violation)', async ({ page, siteGuards }) => {
        await recordViolations(page);
        // The 404 page too: an unknown address gets out/404.html, which carries its own policy.
        // It is read as plain HTML, not loaded in the browser: the page refreshes to Home at once
        // (BUWEB-123), which would race the read ("Execution context was destroyed").
        for (const p of [...PAGES, '/no-such-page/']) {
            let policy;
            if (p === '/no-such-page/') {
                const res = await page.request.get(p);
                expect.soft(res.status(), `${p}: serves the 404 page`).toBe(404);
                const html = await res.text();
                expect.soft(html, `${p}: is the site's 404 page`).toContain('This page could not be found.');
                policy = [...html.matchAll(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi)]
                    .map((m) => (m[0].match(/\bcontent="([^"]*)"/i) ?? [])[1])
                    .map((c) => c?.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
            } else {
                await page.goto(p);
                await settle(page);
                policy = await page.locator('head meta[http-equiv="Content-Security-Policy"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
            }
            expect.soft(policy.length, `${p}: Content-Security-Policy meta tags (the build writes one per page)`).toBe(1);
            const script = (policy[0] ?? '').split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src') || d.startsWith('default-src')) ?? '';
            expect.soft(script, `${p}: the script policy`).not.toBe('');
            expect.soft(script, `${p}: script policy allows unsafe-inline`).not.toContain("'unsafe-inline'");
            expect.soft(script, `${p}: script policy allows unsafe-eval`).not.toContain("'unsafe-eval'");
        }
        // Control: an inline script added after load must be blocked AND recorded. If the page had no
        // policy, or the recorder were blind, nothing would be recorded and this fails.
        await page.goto('/');
        await settle(page);
        await page.evaluate(() => {
            const s = document.createElement('script');
            s.textContent = 'window.__ranInline = true';
            document.head.append(s);
        });
        await expect.poll(() => page.evaluate(() => window.__csp.length), 'the recorder sees a made-up violation').toBeGreaterThan(0);
        expect.soft(await page.evaluate(() => window.__ranInline), 'the made-up inline script ran').toBeUndefined();
        // That made-up violation also reached the console; clear it so only this test's own control is excused.
        siteGuards.jsErrors.splice(0, siteGuards.jsErrors.length, ...siteGuards.jsErrors.filter((m) => !CSP_NOTE.test(m)));
    });
});
