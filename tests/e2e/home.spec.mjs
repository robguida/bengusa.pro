// Home: the hero, the app-grid heading and the cards (spec 17.a, 17.b, 13.a;
// acceptance checks 3, 25.a and 25.b). The words come from support/words.mjs
// (copied from the spec), never from content/.
import { test, expect, isPhone, isReducedMotion, settle } from '../support/site.mjs';
import { TRIGGER, popupsLive } from '../support/offgrid.mjs';
import { APPS, COLOUR, WORDS } from '../support/words.mjs';

// Read headings with innerText, never textContent: the popup's words sit
// inside the heading's markup (hidden until opened).
const text = (locator) => locator.evaluate((el) => el.innerText.replace(/\s+/g, ' ').trim());
const style = (locator, props) => locator.evaluate((el, names) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(names.map((n) => [n, cs[n]]));
}, props);

test.describe('Home', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words and layout do not change with motion; the normal pass covers them');
        await page.goto('/');
        await popupsLive(page);
    });

    test('hero: "Makers of Off-grid apps." with a green "Off-grid" on one line, then the navy subline, then the app grid', async ({ page }, testInfo) => {
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        expect.soft(await text(h1), 'hero words').toBe(WORDS.hero);
        expect.soft(await text(h1), 'hero: "apps" is lowercase').toMatch(/ apps\.$/);
        await expect.soft(page.getByRole('heading', { level: 1, name: WORDS.hero, exact: true }), 'hero accessible name').toBeVisible();

        const word = h1.locator(TRIGGER);
        await expect(word).toHaveText(WORDS.offGridWord);
        expect.soft(await style(word, ['color']), '"Off-grid" in the hero is green').toEqual({ color: COLOUR.green });
        expect.soft(await style(h1, ['color']), 'the rest of the hero is navy').toEqual({ color: COLOUR.navy });

        // "Off-grid" never splits across two lines (17.a.iv), at any width
        // this screen type is used at.
        const widths = isPhone(testInfo) ? [320, 360, 375, 390, 414, 430] : [760, 900, 1024, 1280, 1440];
        const start = page.viewportSize();
        for (const w of widths) {
            await page.setViewportSize({ width: w, height: start.height });
            // Count the lines the word's own letters sit on (a Range sees a
            // break inside an inline-block too, where the button's box would not).
            const lines = await word.evaluate((el) => {
                const range = document.createRange();
                range.selectNodeContents(el);
                const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top));
                return new Set(tops).size;
            });
            expect.soft(lines, `"Off-grid" lines at ${w}px`).toBe(1);
        }
        await page.setViewportSize(start);
        await settle(page);

        // The subline: right after the heading, navy, about 45% of its size (17.a.ii).
        const subline = h1.locator('xpath=following-sibling::*[1]');
        expect.soft(await subline.evaluate((el) => el.tagName), 'the element after the hero heading').toBe('P');
        expect.soft(await text(subline), 'subline words').toBe(WORDS.heroSubline);
        expect.soft(await style(subline, ['color']), 'subline is navy').toEqual({ color: COLOUR.navy });
        const ratio = await page.evaluate(() => {
            const h = document.querySelector('h1');
            return parseFloat(getComputedStyle(h.nextElementSibling).fontSize) / parseFloat(getComputedStyle(h).fontSize);
        });
        expect.soft(ratio, 'subline size / hero size').toBeGreaterThanOrEqual(0.4);
        expect.soft(ratio, 'subline size / hero size').toBeLessThanOrEqual(0.5);

        // Nothing between the hero and the grid (17.a.v): the subline is the
        // hero's last element, and the next section is the app grid, whose
        // heading and cards come first.
        const order = await page.evaluate(() => {
            const hero = document.querySelector('h1').closest('section');
            const after = hero.nextElementSibling;
            return {
                lastInHero: hero.lastElementChild === document.querySelector('h1').nextElementSibling,
                next: after ? `${after.tagName.toLowerCase()}#${after.id}` : 'nothing',
                gridChildren: after ? [...after.children].map((c) => c.tagName.toLowerCase() + (c.id ? `#${c.id}` : '')) : [],
            };
        });
        expect.soft(order.lastInHero, 'the subline is the last thing in the hero').toBe(true);
        expect.soft(order.next, 'right after the hero').toBe('section#apps');
        expect.soft(order.gridChildren, 'the grid section: its heading, then the cards').toEqual(['h2#apps-title', 'ul']);
    });

    test('heading: "Meet our Off-grid apps" with "Off-grid" as a popup word; the "More in the works" tile never says Off-grid', async ({ page }) => {
        const h2 = page.locator('h2#apps-title');
        expect.soft(await text(h2), 'heading words').toBe(WORDS.appsHeading);
        const word = h2.locator(TRIGGER);
        await expect(word).toHaveText(WORDS.offGridWord);
        // 17.c.vi: the trigger carries a dotted green underline; 6.f: the word is navy here.
        expect.soft(await style(word, ['color', 'textDecorationLine', 'textDecorationStyle', 'textDecorationColor']), 'heading word look').toEqual({
            color: COLOUR.navy, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: COLOUR.green,
        });
        // The hero word is a trigger too, with the same dotted green underline.
        expect.soft(await style(page.locator(`h1 ${TRIGGER}`), ['textDecorationStyle', 'textDecorationColor']), 'hero word underline').toEqual({
            textDecorationStyle: 'dotted', textDecorationColor: COLOUR.green,
        });

        const tile = page.locator('#apps li').last();
        await expect(tile.getByRole('heading', { name: 'More in the works' })).toBeVisible();
        const tileText = await tile.evaluate((el) => el.textContent);
        expect.soft(tileText, 'tile never says "Off-grid"').not.toMatch(/off[\s-]?grid/i);
        expect.soft(tileText, 'tile never says "Cloud-killers"').not.toMatch(/cloud[\s-]?killers?/i);
        await expect.soft(tile.locator(TRIGGER), 'no badge on the tile').toHaveCount(0);
    });

    test('Catche, TimeTracker and Vault each wear the badge, with the short form on the card; Vault\'s old card note is gone', async ({ page }) => {
        const cards = page.locator('#apps article');
        await expect(cards).toHaveCount(APPS.length);
        for (const [i, app] of APPS.entries()) {
            const card = cards.nth(i);
            await expect.soft(card.locator('h3'), `card ${i + 1} name`).toHaveText(app.name);
            const badge = card.locator(TRIGGER);
            await expect.soft(badge, `${app.shortName}: one badge`).toHaveCount(1);
            if (await badge.count() === 1) {
                await expect.soft(badge, `${app.shortName}: badge words`).toHaveText(WORDS.offGridWord);
                expect.soft(await style(badge, ['backgroundColor', 'color']), `${app.shortName}: badge colours`).toEqual({
                    backgroundColor: COLOUR.green, color: COLOUR.white,
                });
            }
            // The short form stays on the card with no tap (17.c.i).
            const visible = await card.evaluate((el) => el.innerText.replace(/\s+/g, ' '));
            expect.soft(visible, `${app.shortName}: short form on the card`).toContain(WORDS.shortForm);
        }
        const vault = await cards.nth(2).evaluate((el) => el.textContent);
        expect.soft(vault, 'Vault card: the old sync note is gone (13.e.ii)').not.toContain('Sync between devices is planned');
        expect.soft(vault, 'Vault card: no "doesn\'t wear the Off-grid badge"').not.toMatch(/doesn['’]t wear the Off-grid badge/i);
    });
});
