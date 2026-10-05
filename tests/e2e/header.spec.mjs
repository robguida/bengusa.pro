// Header end states. Tests read sizes only once the page has settled, never
// mid-animation, so they do not fail at random.
import {
    test, expect, PAGES, expectPx, headerSizes, isPhone, isReducedMotion, logoHeight, menuButton, scrollToY, settle,
} from '../support/site.mjs';

test.describe('header end states', () => {
    test('Home: big at the top, docked when scrolled to the bottom, big again back at the top', async ({ page }, testInfo) => {
        const { dock, land } = headerSizes(testInfo);
        // With reduce-motion on, Home starts docked and never changes size.
        const top = isReducedMotion(testInfo) ? dock : land;
        await page.goto('/');
        await settle(page);
        expectPx(await logoHeight(page), top, 'Home at the top');

        const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        expect(max, 'Home must be tall enough to scroll').toBeGreaterThan(200);
        const y = await scrollToY(page, max + 1000);
        expect(y).toBeGreaterThanOrEqual(max - 1);
        expectPx(await logoHeight(page), dock, `Home scrolled to the bottom (scrollY ${y})`);

        await scrollToY(page, 0);
        expectPx(await logoHeight(page), top, 'Home back at the top');
    });

    test('every other page starts docked', async ({ page }, testInfo) => {
        const { dock } = headerSizes(testInfo);
        for (const p of PAGES.filter((x) => x !== '/')) {
            await page.goto(p);
            await settle(page);
            expectPx(await logoHeight(page), dock, p);
        }
    });

    test('reduce-motion: the logo never changes size while scrolling, and nothing animates', async ({ page }, testInfo) => {
        test.skip(!isReducedMotion(testInfo), 'reduce-motion pass only');
        const { dock } = headerSizes(testInfo);
        await page.goto('/');
        await settle(page);
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
            await settle(page);
            expectPx(await logoHeight(page), dock, 'Home first frame, scripts off');
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
            await menuButton(page, testInfo).click();
            await settle(page);
            const open = await page.evaluate(() => document.documentElement.scrollWidth);
            expect.soft(open, `${p} menu open: page width vs screen`).toBeLessThanOrEqual(closed.view);
        }
    });
});
