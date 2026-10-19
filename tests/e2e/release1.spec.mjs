// Release 1 (BUWEB-114), in the browser: the Privacy page word for word, no
// draft label, the cleared page descriptions, and no cookies (the Privacy page
// says there are none, so the test holds the site to it).
// Soft checks everywhere: every miss is reported.
import { test, expect, PAGES, isReducedMotion, settle } from '../support/site.mjs';
import { DRAFT_LABEL, PRIVACY, privacyMainText } from '../support/words.mjs';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

test.describe('Release 1', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words do not change with motion; the normal pass covers them');
    });

    test('Privacy: exactly the approved words, block by block, and nothing else', async ({ page }) => {
        await page.goto(PRIVACY.path);
        await settle(page);
        const main = page.locator('main');
        await expect.soft(page.locator('h1')).toHaveCount(1);
        await expect.soft(page.locator('h1')).toHaveText(PRIVACY.title);
        const lines = (await main.innerText()).split('\n').map(clean).filter(Boolean);
        const last = lines[lines.length - 1];
        expect.soft(lines.slice(0, -1), 'main, block by block, up to the date line').toEqual(privacyMainText());
        expect.soft(last, 'the last line is the date line').toBe(PRIVACY.updated);
        // Crawler and screen-reader text: the same characters and nothing more.
        const squash = (s) => s.replace(/\s+/g, '');
        const all = await main.evaluate((el) => el.textContent);
        expect.soft(squash(all), 'main, all text including hidden text').toBe(squash([...privacyMainText(), PRIVACY.updated].join('')));
        // Plain ASCII, as the legal reviewer wrote it (straight apostrophes only).
        expect.soft([...all].filter((c) => c.charCodeAt(0) > 126), 'characters outside plain ASCII').toEqual([]);
        // The page makes no promise it cannot keep: no form, no email address, no link to a hidden page.
        await expect.soft(main.locator('form, input, textarea, select, button'), 'form controls on Privacy').toHaveCount(0);
        expect.soft(all, 'an email address on Privacy').not.toMatch(/@/);
        await expect.soft(main.locator('a'), 'links in the Privacy text').toHaveCount(0);
    });

    test('the Privacy comparison fails on made-up bad text (it can fail)', () => {
        const want = privacyMainText();
        const edits = [
            want.map((l, i) => (i === 3 ? l.replace('14 days', '30 days') : l)),
            want.slice(0, -1),
            [...want, 'Questions? Write to us.'],
            want.map((l) => l.replace("doesn't", 'does not')),
        ];
        for (const [i, bad] of edits.entries()) expect.soft(bad, `made-up edit ${i + 1}`).not.toEqual(want);
        expect.soft('Last updated: October 20, 2026.', 'a wrong date').not.toBe(PRIVACY.updated);
        expect.soft(PRIVACY.updated, 'the date line is exact').toBe('Last updated: October 19, 2026.');
    });

    test('no draft label on any shown page, and no page holds the words "Draft words" or "Not final"', async ({ page }) => {
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            const text = clean(await page.evaluate(() => document.body.textContent));
            expect.soft(text, `${p}: the draft label`).not.toContain(DRAFT_LABEL);
            expect.soft(text.match(/draft words|not final/gi) ?? [], `${p}: draft wording`).toEqual([]);
        }
    });

    test('each page has its cleared description, and the share preview has no image', async ({ page }) => {
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            const desc = await page.locator('head meta[name="description"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));
            expect.soft(desc, `${p}: description`).toEqual([PRIVACY.descriptions[p]]);
            await expect.soft(page.locator('head meta[property="og:image"], head meta[name="twitter:image"]'), `${p}: a share-preview image`).toHaveCount(0);
        }
    });

    test('no cookies on any shown page, from the server or from a script', async ({ page, context }) => {
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            expect.soft(await page.evaluate(() => document.cookie), `${p}: document.cookie`).toBe('');
        }
        expect.soft(await context.cookies(), 'cookies held by the browser after every page').toEqual([]);
    });

    test('the footer on every page has the Privacy link and no Contact link', async ({ page }) => {
        for (const p of PAGES) {
            await page.goto(p, { waitUntil: 'domcontentloaded' });
            const links = await page.locator('footer a[href]').evaluateAll((els) => els.map((e) => ({ href: e.getAttribute('href'), text: e.textContent.trim() })));
            expect.soft(links.map((l) => l.text).filter((t) => /contact/i.test(t)), `${p}: a Contact link in the footer`).toEqual([]);
            expect.soft(links.some((l) => l.href === '/privacy/' && l.text === 'Privacy'), `${p}: the Privacy link`).toBe(true);
        }
    });
});
