// Shared facts and fixtures for the browser tests.
import { test as base, expect } from '@playwright/test';
import { expectedRoutes } from '../../scripts/lib/export-checks.mjs';

// Every page, as the browser asks for it (trailingSlash: true).
export const PAGES = expectedRoutes().map((r) => (r === '/' ? '/' : `${r}/`));

// Header end sizes = the logo mark's height. "dock" = 2.5x today's 46px logo,
// set by Rob on 2026-10-06 (spec 6.c, --hdr-h-end in globals.css).
// "land" = Home at the very top. "dock" = scrolled, and every other page.
// The phone landing size is a clamp() of the screen width: 128.69px at 390px.
// "word" = the docked "bengUSA.pro" lettering's height. It keeps the size the
// 2x option gave it (spec 6.c, acceptance check 2; --hdr-h-word-end): 29px on
// a computer, 24px on a phone. The build draws 29.44px and 23.91px, inside
// PX_TOLERANCE of the spec's whole numbers. Lettering that followed the 2.5x
// logo would be 32.89px on a computer, far outside it.
export const HEADER = {
    desktop: { dock: 115, land: 240, word: 29 },
    phone: { dock: 69, land: 128.69, word: 24 },
};
export const PX_TOLERANCE = 0.75;

// The lettering's DRAWN size, in the build's own px, for the checks that need
// more than the spec's whole numbers: Home at the top, and the whole shrink.
// Measured 2026-10-06 (Chromium and WebKit agree to 0.01px). The project
// lead accepted 23.91px at the top of Home on a phone as what spec 6.c's
// "24px at every size" means (it was 24.2px at 390px before BUWEB-106a-r2).
//   - docked: 29.44px on a computer, 23.91px on a phone (spec: 29 / 24);
//   - Home at the top: 61.63px at 1280px, 23.91px at 390px.
// WORD_TOLERANCE is small on purpose: the old phone path started at 24.2px.
export const WORD = {
    desktop: { dock: 29.44, land: 61.63 },
    phone: { dock: 23.91, land: 23.91 },
};
export const WORD_TOLERANCE = 0.1;

// The lettering's path through the whole shrink on Home, top to docked, by
// screen width (spec 6.c):
//   - 'hold': it stays at its docked size the whole way (phones about 388px
//     wide and up);
//   - 'rise': it never shrinks, and grows up to its docked size (narrower
//     phones, where 24px does not fit at the top);
//   - 'fall': it never grows, and shrinks from its Home size to its docked
//     size (computers). 37.88px at 760px is the room left before the menu.
export const WORD_PATH = {
    phone: [
        { width: 390, path: 'hold' },
        { width: 430, path: 'hold' },
        { width: 360, path: 'rise' },
    ],
    desktop: [
        { width: 760, path: 'fall', top: 37.88 },
        { width: 1280, path: 'fall', top: 61.63 },
    ],
};

// RULE: never wait a fixed time and then measure. Wait for the STATE you need.
// A timeout below is only a ceiling that turns "never got there" into a red
// test; reaching the state early always ends the wait early.
const START_TIMEOUT = 15_000; // the page's scripts have started (busy CI machines are slow)
const STATE_TIMEOUT = 5_000; // a size or a scroll position has reached its end state
// Each page load's own limit, shorter than any test's (30s, or 60s / 90s for
// the long walks). A load that stalls then fails on its own, naming the
// page, and the test still has time left to save its trace.
const NAV_TIMEOUT = 15_000;
const STABLE_FRAMES = 3; // "stopped changing" = this many animation frames in a row with no change

// Stress knob (off by default): E2E_SLOW_START_MS=150 holds back every
// message-channel task by that many ms. React schedules its start-up work in
// small tasks of that kind, so the page finishes starting up well after the
// load event, like on a busy CI machine. The suite must stay green with it on.
const SLOW_START_MS = Number(process.env.E2E_SLOW_START_MS || 0);

export const isPhone = (testInfo) => testInfo.project.use.viewport.width < 760;
export const isReducedMotion = (testInfo) => testInfo.project.use.reducedMotion === 'reduce';
export const headerSizes = (testInfo) => (isPhone(testInfo) ? HEADER.phone : HEADER.desktop);

// Browser contexts that run with page scripts switched off (filled in by the
// fixture below). Nothing on those pages can change after load.
const scriptsOff = new WeakSet();

// Runs in every page before the page's own scripts. A stand-in for the React
// DevTools hook: production React reports to it after each commit, once that
// commit's effects have run. The first report means React has finished
// starting the page, so the header's scroll code is attached. Records that,
// changes nothing else.
function startProbe() {
    const state = { started: false };
    window.__e2eStart = state;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        isDisabled: false,
        supportsFiber: true,
        inject: () => 1,
        onCommitFiberRoot() {},
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() { state.started = true; },
    };
}

// Waits until the page is ready to measure:
//   1. scripts on: React has finished starting the page (see startProbe);
//   2. the scroll position and the logo's height have stopped changing.
// The load event alone is not enough: on a busy machine React starts the page
// after it, and a size read before that is the server's first frame.
export async function settle(page) {
    if (scriptsOff.has(page.context())) return; // nothing will run; reads force layout themselves
    await page.waitForFunction(() => window.__e2eStart?.started === true, null, { timeout: START_TIMEOUT })
        .catch((err) => {
            throw new Error(`React did not finish starting ${page.url()} within ${START_TIMEOUT}ms `
                + `(no commit reported to the start probe in tests/support/site.mjs): ${err.message}`);
        });
    await steady(page);
}

// Waits until the scroll position and the logo's height are the same for
// STABLE_FRAMES animation frames in a row.
async function steady(page) {
    const result = await page.evaluate(({ frames, timeout }) => new Promise((resolve) => {
        const read = () => {
            const el = document.querySelector('[data-logo="mark"]');
            return `scrollY ${Math.round(window.scrollY)}, logo ${el ? el.getBoundingClientRect().height : 'missing'}`;
        };
        let last = read();
        let same = 0;
        const stop = setTimeout(() => resolve({ ok: false, last }), timeout);
        const tick = () => {
            const now = read();
            same = now === last ? same + 1 : 0;
            last = now;
            if (same >= frames) {
                clearTimeout(stop);
                resolve({ ok: true, last });
            } else {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    }), { frames: STABLE_FRAMES, timeout: STATE_TIMEOUT });
    expect(result.ok, `${page.url()} still changing after ${STATE_TIMEOUT}ms (last: ${result.last})`).toBe(true);
}

// The logo reaches `expected` px and stays there. Re-reads the page until it
// does (reads only: nothing is clicked or scrolled again), then checks it has
// stopped changing and is still right. Fails with the last height seen.
export async function expectLogoPx(page, expected, label) {
    await expect(async () => expectPx(await logoHeight(page), expected, label))
        .toPass({ timeout: STATE_TIMEOUT, intervals: [20, 50, 100] });
    await settle(page);
    expectPx(await logoHeight(page), expected, `${label}, after it stopped changing`);
}

// Waits until the page has started (see settle), then until it has started no
// request and has none waiting for an answer for `ms`, so prefetches started
// by a scroll or a click have been answered (their status is known). Gives up
// quietly after `max` ms: this is a pause for prefetches to happen, not a check.
// The quiet window is the one time-based wait left, on purpose: no page state
// says "Next has finished prefetching" (it skips links it already fetched on
// an earlier page). If it ends early, a request is missed: a weaker check,
// not a red one (except the Windows expected-failure marker in navigation,
// which only runs on a build with the known export bug, outside strict mode).
// Waiting for start-up first matters: Next only prefetches once React has
// started the page.
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
        await settle(page);
        last = Date.now();
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

// The "bengUSA.pro" lettering's height. Read it after expectLogoPx() or
// settle(): it is drawn from the same --h, so once the logo has stopped
// changing, so has the lettering.
export async function wordHeight(page) {
    return page.evaluate(() => {
        const el = document.querySelector('[data-logo="word"]');
        return el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : -1;
    });
}

// The header's shape has no test hook of its own (it is decoration, inside an
// aria-hidden wrapper): the bar is that wrapper's <div>, and the tab is its
// <svg>, whose last <path> is the navy edge. Its bottom is the bottom of the tab.
const SHAPE = 'header [aria-hidden="true"]';
export const TAB_EDGE = `${SHAPE} > svg > path:last-of-type`;
export const BAR = `${SHAPE} > div`;

// Header geometry right now, in screen px: the tab's bottom edge, the bar's
// height, the logo's height and the lettering's height.
export async function headerGeometry(page) {
    return page.evaluate(({ tab, bar }) => {
        const round = (v) => Math.round(v * 100) / 100;
        const edge = document.querySelector(tab);
        const strip = document.querySelector(bar);
        const logo = document.querySelector('[data-logo="mark"]');
        const word = document.querySelector('[data-logo="word"]');
        return {
            tabBottom: edge ? round(edge.getBoundingClientRect().bottom) : -1,
            bar: strip ? round(strip.getBoundingClientRect().height) : -1,
            logo: logo ? round(logo.getBoundingClientRect().height) : -1,
            word: word ? round(word.getBoundingClientRect().height) : -1,
            minBar: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-min-bar')) || -1,
        };
    }, { tab: TAB_EDGE, bar: BAR });
}

export async function tabBottom(page) {
    return (await headerGeometry(page)).tabBottom;
}

// The header's shrink distance on this screen: how far Home must scroll for
// the logo to go from its Home size to docked. It is the big tab's bottom
// minus the docked tab's, --hdr-land-bottom minus --hdr-end-bottom in
// globals.css (the same sum SiteHeader.js walks), worked out by the browser
// from the tokens, never typed here. 0 with reduce-motion: there the Home
// size IS the docked size. Read through a hidden probe that is removed at
// once (set through CSSOM, which the pages' security policy allows).
export async function shrinkDistance(page) {
    return page.evaluate(() => {
        const resolve = (token) => {
            const el = document.createElement('div');
            el.style.setProperty('position', 'absolute');
            el.style.setProperty('visibility', 'hidden');
            el.style.setProperty('top', '0');
            el.style.setProperty('height', `var(${token})`);
            document.body.append(el);
            const h = el.getBoundingClientRect().height;
            el.remove();
            return h;
        };
        return Math.round((resolve('--hdr-land-bottom') - resolve('--hdr-end-bottom')) * 100) / 100;
    });
}

export async function scrollToY(page, y) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await settle(page);
    return page.evaluate(() => Math.round(window.scrollY));
}

// Home's subline: the first <p> after the hero heading. Not simply the next
// element: the hero word's popup box sits right after the heading.
export const heroSubline = (page) => page.locator('h1').locator('xpath=following-sibling::p[1]');

// The menu button for this screen: "Apps" on a computer, "Menu" on a phone.
export function menuButton(page, testInfo) {
    return isPhone(testInfo)
        ? page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Menu', exact: true })
        : page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Apps', exact: true });
}

// Every browser test runs with these guards, automatically:
//   - any request that leaves the local test server is BLOCKED and fails the test;
//   - any JavaScript error (uncaught, or console.error) fails the test;
//   - each page load has its own time limit (NAV_TIMEOUT).
// Network errors such as a 404 are not JavaScript errors; the
// "no 404s while browsing" test covers them.
//
// Why the block is a route with a match function, and stays one: in
// Playwright 1.63 ANY route makes the browser pause every request (Chromium
// and WebKit both intercept every address), whatever the route's URL
// pattern. A pattern only moves the match from this test process into
// Playwright's own driver; the browser still pauses each local request until
// it is let through. So no pattern can stop local requests from being
// paused. A proxy-based block was not taken either: it is a different guard
// (Chromium skips a proxy for loopback addresses by default, and a blocked
// request would no longer be recorded by its address), with no proof yet in
// all three browsers. Checked in Playwright's own code, 2026-10-06.
export const test = base.extend({
    siteGuards: [async ({ context, baseURL, javaScriptEnabled }, use) => {
        const outside = [];
        const jsErrors = [];
        context.setDefaultNavigationTimeout(NAV_TIMEOUT);
        if (javaScriptEnabled === false) scriptsOff.add(context);
        await context.addInitScript(startProbe);
        const isLocal = (url) => url.startsWith(`${baseURL}/`) || url === baseURL
            || url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank';
        await context.route((url) => !isLocal(url.href), (route) => {
            outside.push(route.request().url());
            return route.abort('blockedbyclient');
        });
        if (SLOW_START_MS > 0) {
            await context.addInitScript((ms) => {
                const post = MessagePort.prototype.postMessage;
                // The real timer, kept here: this runs before a test's fake
                // clock (page.clock) is put in, and a slow machine is slow in
                // real time. On the fake clock's timer, a frozen clock would
                // also freeze React.
                const later = window.setTimeout.bind(window);
                MessagePort.prototype.postMessage = function slowed(...args) {
                    later(() => post.apply(this, args), ms);
                };
            }, SLOW_START_MS);
        }
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
