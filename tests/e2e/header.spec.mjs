// Header end states. Tests wait for the page's STATE (scripts started, the
// logo at its end size and no longer changing), never a fixed time, so a slow
// machine cannot make them fail at random. See settle() in support/site.mjs.
import {
    test, expect, PAGES, expectLogoPx, headerSizes, isPhone, isReducedMotion, logoHeight, menuButton, scrollToY, settle,
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
