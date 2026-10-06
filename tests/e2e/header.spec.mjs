// Header end states. Tests wait for the page's STATE (scripts started, the
// logo at its end size and no longer changing), never a fixed time, so a slow
// machine cannot make them fail at random. See settle() in support/site.mjs.
import {
    test, expect, PAGES, expectLogoPx, expectPx, headerGeometry, headerSizes, isPhone, isReducedMotion, logoHeight, menuButton,
    scrollToY, settle,
} from '../support/site.mjs';

test.describe('header end states', () => {
    test('Home: big at the top, docked when scrolled to the bottom, big again back at the top', async ({ page }, testInfo) => {
        const { dock, land } = headerSizes(testInfo);
        // With reduce-motion on, Home starts docked and never changes size.
        const top = isReducedMotion(testInfo) ? dock : land;
        await page.goto('/');
        await settle(page);
        await expectLogoPx(page, top, 'Home at the top');

        const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        expect(max, 'Home must be tall enough to scroll').toBeGreaterThan(200);
        const y = await scrollToY(page, max + 1000);
        expect(y).toBeGreaterThanOrEqual(max - 1);
        await expectLogoPx(page, dock, `Home scrolled to the bottom (scrollY ${y})`);

        await scrollToY(page, 0);
        await expectLogoPx(page, top, 'Home back at the top');
    });

    // At 2x (92px) the computer bar reaches its minimum height before the logo
    // has finished shrinking, so the logo goes on shrinking after the bar
    // stops (the phone has always done this). Walks the whole shrink, down
    // and back up, a few px at a time, and checks at every step:
    //   - the tab's bottom edge moves exactly with the page, so the content
    //     under it never jumps (spec 6.c: "it shrinks into the tab");
    //   - the logo only ever shrinks on the way down and grows on the way up;
    //   - the bar does stop at its minimum while the logo is still bigger
    //     than docked (proves this path is the one being walked).
    // Run it with E2E_SLOW_START_MS=150 too (see tests/README.md).
    test('Home: the shrink path to 2x moves with the page (no jump), including after the bar stops at its minimum', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'with reduce-motion nothing shrinks; the reduce-motion test covers it');
        test.setTimeout(60_000); // ~100 scroll steps, each waiting for the page to settle
        const { dock, land } = headerSizes(testInfo);
        await page.goto('/');
        await settle(page);
        await expectLogoPx(page, land, 'Home at the top');
        const top = await headerGeometry(page);
        await scrollToY(page, 100000);
        await expectLogoPx(page, dock, 'Home scrolled to the bottom');
        const docked = await headerGeometry(page);
        const travel = Math.ceil(top.tabBottom - docked.tabBottom) + 6; // a few px past the docking point
        expect(travel, 'the tab has a shrink path to walk').toBeGreaterThan(20);

        // 4px steps, then 1px steps over the last 16px, where the bar stops
        // and the logo keeps shrinking (a window only ~4px of scroll wide).
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
                }
                last = s;
            }
            return seen;
        };
        const down = await walk(ys, 'down');
        const knee = down.filter((s) => Math.abs(s.bar - s.minBar) <= 0.5 && s.logo > dock + 1);
        expect(knee.length, `steps where the bar is at its ${down[0].minBar}px minimum and the logo still above ${dock}px`)
            .toBeGreaterThan(0);
        expectPx(down.at(-1).logo, dock, 'logo at the end of the shrink path');
        await walk([...ys].reverse(), 'up');
        await expectLogoPx(page, land, 'Home back at the top');
    });

    test('every other page starts docked', async ({ page }, testInfo) => {
        const { dock } = headerSizes(testInfo);
        for (const p of PAGES.filter((x) => x !== '/')) {
            await page.goto(p);
            await settle(page);
            await expectLogoPx(page, dock, p);
        }
    });

    test('reduce-motion: the logo never changes size while scrolling, and nothing animates', async ({ page }, testInfo) => {
        test.skip(!isReducedMotion(testInfo), 'reduce-motion pass only');
        const { dock } = headerSizes(testInfo);
        await page.goto('/');
        await settle(page); // the scripts have started, so the header's scroll code is live from here on
        const seen = new Set([await logoHeight(page)]);
        for (const y of [50, 150, 400, 100000, 0]) {
            await scrollToY(page, y);
            seen.add(await logoHeight(page));
        }
        expect([...seen], 'logo heights seen while scrolling').toEqual([dock]);
        expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0);
    });

    test.describe('scripts off', () => {
        test.use({ javaScriptEnabled: false });
        test('reduce-motion: the very first frame is already docked (no jump when scripts load)', async ({ page }, testInfo) => {
            test.skip(!isReducedMotion(testInfo), 'reduce-motion pass only');
            const { dock } = headerSizes(testInfo);
            await page.goto('/');
            await expectLogoPx(page, dock, 'Home first frame, scripts off');
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
