// Header end states. Tests wait for the page's STATE (scripts started, the
// logo at its end size and no longer changing), never a fixed time, so a slow
// machine cannot make them fail at random. See settle() in support/site.mjs.
//
// Docked = the logo at 2.5x today's logo (115px computer, 69px phone) and the
// "bengUSA.pro" lettering at the size the 2x option gave it (29px computer,
// 24px phone). Spec 6.c and acceptance check 2.
import {
    test, expect, PAGES, WORD, WORD_PATH, WORD_TOLERANCE, expectLogoPx, expectPx, headerGeometry, headerSizes, isPhone,
    isReducedMotion, logoHeight, menuButton, scrollToY, settle, wordHeight,
} from '../support/site.mjs';

// The docked lettering. Call it once the logo is docked (after expectLogoPx):
// by then the header has stopped changing.
async function expectDockedWord(page, testInfo, label) {
    expectPx(await wordHeight(page), headerSizes(testInfo).word, `${label}: docked "bengUSA.pro" lettering`);
}

// The lettering's drawn size, to WORD_TOLERANCE. Same timing rule as above.
async function expectWordDrawn(page, want, label) {
    const got = await wordHeight(page);
    expect(Math.abs(got - want), `${label}: "bengUSA.pro" lettering ${got}px, want ${want}px (±${WORD_TOLERANCE})`)
        .toBeLessThanOrEqual(WORD_TOLERANCE);
}

// Per step of scroll, the lettering may wobble by this much and still count
// as "not moving" (a rounding step, far below any real change).
const WORD_STEP_SLACK = 0.05;

// The lettering never jumps: per px of scroll it changes by at most this much.
// The build's steepest stretch is 0.33px per px, on both screens.
const WORD_RATE_MAX = 0.5;

test.describe('header end states', () => {
    test('Home: big at the top, docked when scrolled to the bottom, big again back at the top', async ({ page }, testInfo) => {
        const { dock, land } = headerSizes(testInfo);
        // With reduce-motion on, Home starts docked and never changes size.
        const top = isReducedMotion(testInfo) ? dock : land;
        await page.goto('/');
        await settle(page);
        await expectLogoPx(page, top, 'Home at the top');
        if (isReducedMotion(testInfo)) await expectDockedWord(page, testInfo, 'Home at the top, reduce-motion');
        // The big Home lettering: 61.63px at 1280px, 23.91px at 390px (a
        // phone holds its docked size the whole way; it was 24.2px before r2).
        else await expectWordDrawn(page, (isPhone(testInfo) ? WORD.phone : WORD.desktop).land, 'Home at the top');

        const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        expect(max, 'Home must be tall enough to scroll').toBeGreaterThan(200);
        const y = await scrollToY(page, max + 1000);
        expect(y).toBeGreaterThanOrEqual(max - 1);
        await expectLogoPx(page, dock, `Home scrolled to the bottom (scrollY ${y})`);
        await expectDockedWord(page, testInfo, `Home scrolled to the bottom (scrollY ${y})`);

        await scrollToY(page, 0);
        await expectLogoPx(page, top, 'Home back at the top');
    });

    // Walks the whole shrink, down and back up, a few px at a time, and
    // checks at every step:
    //   - the tab's bottom edge moves exactly with the page, so the content
    //     under it never jumps (spec 6.c: "it shrinks into the tab");
    //   - the logo only ever shrinks on the way down and grows on the way up;
    //   - the lettering never jumps (at most WORD_RATE_MAX px per px of
    //     scroll), and it ends at its docked size.
    // Which path is walked depends on the screen, and the test checks it:
    //   - phone: the bar reaches its 52px minimum before the logo is docked,
    //     so the logo goes on shrinking after the bar stops;
    //   - computer, at 2.5x (115px): the bar never reaches its 64px minimum.
    //     It stops at 71.5px, when the logo docks.
    // Run it with E2E_SLOW_START_MS=150 too (see tests/README.md).
    test('Home: the shrink path to the dock moves with the page (no jump); the phone bar stops at its minimum first, the computer bar never does', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'with reduce-motion nothing shrinks; the reduce-motion test covers it');
        test.setTimeout(60_000); // ~100 scroll steps, each waiting for the page to settle
        const { dock, land, word } = headerSizes(testInfo);
        await page.goto('/');
        await settle(page);
        await expectLogoPx(page, land, 'Home at the top');
        const top = await headerGeometry(page);
        await scrollToY(page, 100000);
        await expectLogoPx(page, dock, 'Home scrolled to the bottom');
        const docked = await headerGeometry(page);
        const travel = Math.ceil(top.tabBottom - docked.tabBottom) + 6; // a few px past the docking point
        expect(travel, 'the tab has a shrink path to walk').toBeGreaterThan(20);

        // 4px steps, then 1px steps over the last 16px, where the logo docks
        // (and, on a phone, where the bar stops and the logo keeps shrinking:
        // a window only ~9px of scroll wide).
        const ys = [];
        for (let y = 0; y < travel - 16; y += 4) ys.push(y);
        for (let y = Math.max(0, travel - 16); y <= travel; y += 1) ys.push(y);
        const walk = async (list, direction) => {
            const seen = [];
            for (const y of list) {
                const at = await scrollToY(page, y);
                expect(at, `scrolled to ${y}`).toBe(y);
                seen.push({ y, ...(await headerGeometry(page)) });
            }
            let last = null;
            for (const s of seen) {
                const want = Math.max(docked.tabBottom, top.tabBottom - s.y);
                expect.soft(Math.abs(s.tabBottom - want), `${direction}, scrollY ${s.y}: tab bottom ${s.tabBottom}px, want ${want.toFixed(2)}px`)
                    .toBeLessThanOrEqual(1);
                if (last) {
                    const grew = direction === 'down' ? s.logo - last.logo : last.logo - s.logo;
                    expect.soft(grew, `${direction}, scrollY ${last.y} -> ${s.y}: logo ${last.logo} -> ${s.logo}px goes the wrong way`)
                        .toBeLessThanOrEqual(0.05);
                    const step = Math.abs(s.y - last.y);
                    expect.soft(Math.abs(s.word - last.word), `${direction}, scrollY ${last.y} -> ${s.y}: lettering ${last.word} -> ${s.word}px jumps`)
                        .toBeLessThanOrEqual(WORD_RATE_MAX * step + 0.05);
                }
                last = s;
            }
            return seen;
        };
        const down = await walk(ys, 'down');
        const minBar = down[0].minBar;
        const knee = down.filter((s) => Math.abs(s.bar - s.minBar) <= 0.5 && s.logo > dock + 1);
        if (isPhone(testInfo)) {
            expect(knee.length, `steps where the bar is at its ${minBar}px minimum and the logo still above ${dock}px`)
                .toBeGreaterThan(0);
        } else {
            const lowest = Math.min(...down.map((s) => s.bar));
            expect(lowest - minBar, `the computer bar must never reach its ${minBar}px minimum at 2.5x (lowest bar seen: ${lowest}px)`)
                .toBeGreaterThan(0.5);
        }
        expectPx(down.at(-1).logo, dock, 'logo at the end of the shrink path');
        expectPx(down.at(-1).word, word, 'lettering at the end of the shrink path');
        await walk([...ys].reverse(), 'up');
        await expectLogoPx(page, land, 'Home back at the top');
    });

    // The lettering through the whole shrink (spec 6.c), at each width in
    // WORD_PATH: Home loads at that width, then scrolls from the very top to
    // a few px past the docking point, 2px at a time, waiting for the page to
    // settle at every step. Each step is read from the page, never timed.
    //   - phones 390px and 430px ('hold'): 23.91px the whole way, never above 24px;
    //   - phone 360px ('rise'): never shrinks, never above 24px, 23.91px docked;
    //   - computer 760px and 1280px ('fall'): never grows (no bump), from its
    //     Home size (37.88px / 61.63px) to 29.44px docked.
    test('Home: the lettering through the whole shrink, at each phone and computer width (phones stay at or grow to 24px, computers only shrink)', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'with reduce-motion nothing shrinks; the reduce-motion test covers it');
        test.setTimeout(90_000); // ~35 to 75 scroll steps per width, each waiting for the page to settle
        const phone = isPhone(testInfo);
        const word = phone ? WORD.phone : WORD.desktop;
        const { dock, word: specWord } = headerSizes(testInfo);
        const height = page.viewportSize().height;
        for (const { width, path, top } of phone ? WORD_PATH.phone : WORD_PATH.desktop) {
            const at = `${width}px`;
            await page.setViewportSize({ width, height });
            await page.goto('/');
            await settle(page);
            const start = await headerGeometry(page);
            await scrollToY(page, 100000);
            await expectLogoPx(page, dock, `${at}: Home scrolled to the bottom`);
            const travel = Math.ceil(start.tabBottom - (await headerGeometry(page)).tabBottom) + 6;
            expect(travel, `${at}: the tab has a shrink path to walk`).toBeGreaterThan(20);

            const seen = [];
            for (let y = 0; y <= travel; y += 2) {
                const got = await scrollToY(page, y);
                const g = await headerGeometry(page);
                seen.push({ y: got, word: g.word, logo: g.logo });
            }
            const first = seen[0];
            const last = seen.at(-1);
            const max = Math.max(...seen.map((s) => s.word));
            const steps = seen.slice(1).map((s, i) => ({ from: seen[i], to: s }));
            const list = (bad) => bad.map((s) => `scrollY ${s.from.y} -> ${s.to.y}: ${s.from.word} -> ${s.to.word}px`);

            expectPx(last.logo, dock, `${at}: logo at the end of the walk (the walk reached the dock)`);
            expect.soft(Math.abs(last.word - word.dock), `${at}: docked lettering ${last.word}px, want ${word.dock}px (±${WORD_TOLERANCE})`)
                .toBeLessThanOrEqual(WORD_TOLERANCE);
            if (path === 'hold') {
                const off = seen.filter((s) => Math.abs(s.word - word.dock) > WORD_TOLERANCE).map((s) => `scrollY ${s.y}: ${s.word}px`);
                expect.soft(off, `${at}: steps where the lettering is not ${word.dock}px (±${WORD_TOLERANCE})`).toEqual([]);
            }
            if (path === 'hold' || path === 'rise') {
                expect.soft(max, `${at}: largest lettering seen on the way down (never above ${specWord}px)`)
                    .toBeLessThanOrEqual(specWord + WORD_STEP_SLACK);
            }
            if (path === 'rise') {
                const shrank = list(steps.filter((s) => s.to.word < s.from.word - WORD_STEP_SLACK));
                expect.soft(shrank, `${at}: steps where the lettering shrank (it may only grow on the way down)`).toEqual([]);
            }
            if (path === 'fall') {
                expect.soft(Math.abs(first.word - top), `${at}: lettering at the top ${first.word}px, want ${top}px (±${WORD_TOLERANCE})`)
                    .toBeLessThanOrEqual(WORD_TOLERANCE);
                const grew = list(steps.filter((s) => s.to.word > s.from.word + WORD_STEP_SLACK));
                expect.soft(grew, `${at}: steps where the lettering grew (it may only shrink on the way down)`).toEqual([]);
            }
        }
    });

    test('every other page starts docked', async ({ page }, testInfo) => {
        const { dock } = headerSizes(testInfo);
        for (const p of PAGES.filter((x) => x !== '/')) {
            await page.goto(p);
            await settle(page);
            await expectLogoPx(page, dock, p);
            await expectDockedWord(page, testInfo, p);
        }
    });

    test('reduce-motion: the logo and the lettering never change size while scrolling, and nothing animates', async ({ page }, testInfo) => {
        test.skip(!isReducedMotion(testInfo), 'reduce-motion pass only');
        const { dock, word } = headerSizes(testInfo);
        await page.goto('/');
        await settle(page); // the scripts have started, so the header's scroll code is live from here on
        const seen = new Set([await logoHeight(page)]);
        const words = new Set([await wordHeight(page)]);
        for (const y of [50, 150, 400, 100000, 0]) {
            await scrollToY(page, y);
            seen.add(await logoHeight(page));
            words.add(await wordHeight(page));
        }
        expect([...seen], 'logo heights seen while scrolling').toEqual([dock]);
        expect(words.size, `lettering heights seen while scrolling: ${[...words].join(', ')}px`).toBe(1);
        expectPx([...words][0], word, 'lettering while scrolling');
        expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0);
    });

    test.describe('scripts off', () => {
        test.use({ javaScriptEnabled: false });
        test('reduce-motion: the very first frame is already docked (no jump when scripts load)', async ({ page }, testInfo) => {
            test.skip(!isReducedMotion(testInfo), 'reduce-motion pass only');
            const { dock } = headerSizes(testInfo);
            await page.goto('/');
            await expectLogoPx(page, dock, 'Home first frame, scripts off');
            await expectDockedWord(page, testInfo, 'Home first frame, scripts off');
        });
    });

    test('phone: no sideways scroll at 390px on any page, menu closed or open', async ({ page }, testInfo) => {
        test.skip(!isPhone(testInfo), 'phone projects only');
        expect(page.viewportSize().width).toBe(390);
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            const closed = await page.evaluate(() => ({
                doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, view: document.documentElement.clientWidth,
            }));
            expect.soft(closed.doc, `${p} menu closed: page width vs screen`).toBeLessThanOrEqual(closed.view);
            expect.soft(closed.body, `${p} menu closed: body width vs screen`).toBeLessThanOrEqual(closed.view);
            // Release 1 (BUWEB-114): with the apps hidden, About is the only page in the menu, so the
            // phone shows it as a plain link and there is no menu to open. Then only the closed check applies.
            if (await menuButton(page, testInfo).count() === 0) continue;
            // The button's name changes when the menu opens, so find it again by the panel it controls.
            const panelId = await menuButton(page, testInfo).getAttribute('aria-controls');
            const button = page.locator(`button[aria-controls="${panelId}"]`);
            await button.click();
            // Measure the OPEN menu only: wait until it really is open.
            await expect(button, `${p}: menu opened`).toHaveAttribute('aria-expanded', 'true');
            await expect(page.locator(`[id="${panelId}"]`), `${p}: menu panel shown`).toBeVisible();
            await settle(page);
            const open = await page.evaluate(() => document.documentElement.scrollWidth);
            expect.soft(open, `${p} menu open: page width vs screen`).toBeLessThanOrEqual(closed.view);
        }
    });
});
