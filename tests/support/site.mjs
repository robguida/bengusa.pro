// Shared facts and fixtures for the browser tests.
import { test as base, expect } from '@playwright/test';
import { expectedRoutes } from '../../scripts/lib/export-checks.mjs';

// Every page, as the browser asks for it (trailingSlash: true).
export const PAGES = expectedRoutes().map((r) => (r === '/' ? '/' : `${r}/`));

// Header end sizes = the logo mark's height, as approved in BUWEB-104b.
// "land" = Home at the very top. "dock" = scrolled, and every other page.
// The phone landing size is a clamp() of the screen width: 128.69px at 390px.
export const HEADER = {
    desktop: { dock: 115, land: 240 },
    phone: { dock: 69, land: 128.69 },
};
export const PX_TOLERANCE = 0.75;

export const isPhone = (testInfo) => testInfo.project.use.viewport.width < 760;
export const isReducedMotion = (testInfo) => testInfo.project.use.reducedMotion === 'reduce';
export const headerSizes = (testInfo) => (isPhone(testInfo) ? HEADER.phone : HEADER.desktop);

// Two animation frames and a short beat, so scroll handlers have run. Falls
// back to a plain wait when page scripts are switched off.
export async function settle(page) {
    await Promise.race([
        page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))))),
        page.waitForTimeout(500),
    ]).catch(() => page.waitForTimeout(500));
}

// Waits until the page has started no request and has none waiting for an
// answer for `ms`, so prefetches started by a scroll or a click have been
// answered (their status is known). Gives up quietly after `max` ms: this is
// a pause for prefetches to happen, not a check.
export async function networkQuiet(page, ms = 400, max = 3000) {
    const waiting = new Set();
    let last = Date.now();
    const start = (req) => { waiting.add(req); last = Date.now(); };
    const answered = (resOrReq) => {
        waiting.delete(typeof resOrReq.request === 'function' ? resOrReq.request() : resOrReq);
        last = Date.now();
    };
    page.on('request', start);
    page.on('response', answered);
    page.on('requestfailed', answered);
    try {
        const until = Date.now() + max;
        while (Date.now() < until && (waiting.size > 0 || Date.now() - last < ms)) await page.waitForTimeout(50);
    } finally {
        page.off('request', start);
        page.off('response', answered);
        page.off('requestfailed', answered);
    }
}

export function expectPx(actual, expected, label) {
    expect(Math.abs(actual - expected), `${label}: got ${actual}px, want ${expected}px (±${PX_TOLERANCE})`)
        .toBeLessThanOrEqual(PX_TOLERANCE);
}

export async function logoHeight(page) {
    return page.evaluate(() => {
        const el = document.querySelector('[data-logo="mark"]');
        return el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : -1;
    });
}

export async function scrollToY(page, y) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await settle(page);
    return page.evaluate(() => Math.round(window.scrollY));
}

// The menu button for this screen: "Apps" on a computer, "Menu" on a phone.
export function menuButton(page, testInfo) {
    return isPhone(testInfo)
        ? page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Menu', exact: true })
        : page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Apps', exact: true });
}

// Every browser test runs with these guards, automatically:
//   - any request that leaves the local test server is BLOCKED and fails the test;
//   - any JavaScript error (uncaught, or console.error) fails the test.
// Network errors such as a 404 are not JavaScript errors; the
// "no 404s while browsing" test covers them.
export const test = base.extend({
    siteGuards: [async ({ context, baseURL }, use) => {
        const outside = [];
        const jsErrors = [];
        const isLocal = (url) => url.startsWith(`${baseURL}/`) || url === baseURL
            || url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank';
        await context.route((url) => !isLocal(url.href), (route) => {
            outside.push(route.request().url());
            return route.abort('blockedbyclient');
        });
        // WebKit only: when a test leaves a page while Next's prefetches are
        // still running, the cancelled fetches reject with "Fetch API cannot
        // load <url> due to access control checks." That is page teardown,
        // not a site error, and same-origin requests never face real CORS
        // checks. Ignored ONLY for this server's own addresses; any request to
        // another address is blocked and fails the test above.
        const cancelledLocalFetch = (err) => /due to access control checks\.?$/.test(err.message)
            && `${err.stack || ''}`.startsWith(`Fetch API cannot load ${baseURL}/`);
        const watch = (page) => {
            page.on('pageerror', (err) => {
                if (!cancelledLocalFetch(err)) jsErrors.push(`${page.url()}: ${err.message}`);
            });
            page.on('console', (msg) => {
                if (msg.type() === 'error' && !/^Failed to load resource/.test(msg.text())) {
                    jsErrors.push(`${page.url()}: ${msg.text()}`);
                }
            });
        };
        context.pages().forEach(watch);
        context.on('page', watch);
        await use({ outside, jsErrors });
        expect(outside, 'requests that tried to leave the local server (blocked)').toEqual([]);
        expect(jsErrors, 'JavaScript errors').toEqual([]);
    }, { auto: true }],
});

export { expect };
