// The About page (spec decision 18, acceptance check 26). The words come from
// support/words.mjs (copied from the spec), never from content/.
// Loops over people, photos and apps check softly and name the item, or are
// one test per item, so one bad item never hides the others.
import { test, expect, isPhone, isReducedMotion, settle, PX_TOLERANCE } from '../support/site.mjs';
import { APPS, ABOUT, DRAFT_LABEL, WORDS, aboutMainText } from '../support/words.mjs';
import { APPS_PARKED, CONTACT_PARKED, SHOW } from '../support/settings.mjs';
import { TRIGGER, TIP, offGridSection } from '../support/offgrid.mjs';

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const main = (page) => page.locator('main');
const PEOPLE = 'section[aria-labelledby="about-people-title"] > ul > li';

// A soft size check (expectPx in support/site.mjs stops the test).
function softPx(actual, expected, label) {
    expect.soft(Math.abs(actual - expected), `${label}: got ${actual}px, want ${expected}px (±${PX_TOLERANCE})`)
        .toBeLessThanOrEqual(PX_TOLERANCE);
}

test.describe('About page', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words and layout do not change with motion; the normal pass covers them');
    });

    test('the top, the story and the headings, word for word, in order', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        await expect.soft(page.locator('h1')).toHaveCount(1);
        await expect.soft(page.locator('h1')).toHaveText(ABOUT.title);
        await expect.soft(main(page).getByText(ABOUT.line, { exact: true })).toHaveCount(1);
        const h2 = await main(page).locator('h2').allTextContents();
        // "What we're making" is on the page only while the apps are shown (BUWEB-114).
        expect.soft(h2.map(clean), 'section headings, in order').toEqual([ABOUT.storyHeading, ABOUT.peopleHeading, ...(SHOW.apps ? [ABOUT.makingHeading] : [])]);
        // The story is one paragraph, word for word (the legal reviewer's two lines included).
        const story = main(page).locator('p', { hasText: 'We build software for a living.' });
        await expect.soft(story).toHaveCount(1);
        expect.soft(clean(await story.innerText()), 'the story, word for word').toBe(ABOUT.story);
        const text = clean(await main(page).evaluate((el) => el.innerText));
        expect.soft(text, 'the old placeholder is gone').not.toContain(ABOUT.gone);
        expect.soft(text).not.toContain('Coming in a later');
        // The first draft of story lines 2 and 3 was replaced by the legal reviewer's.
        expect.soft(text).not.toContain('We made TimeTracker');
        expect.soft(text).not.toContain('our own server keys');
        // No early signup button (Home's signup is not built yet).
        expect.soft(text).not.toContain('Pick your apps');
        // Release 1 (BUWEB-114): the draft label is off every page.
        expect.soft(text, 'the draft label').not.toContain(DRAFT_LABEL);
        expect.soft(text, 'the draft label, any case').not.toMatch(/draft words|not final/i);
    });

    test('Release 1: no app named or linked, and no Contact line or link, anywhere on About', async ({ page }) => {
        test.skip(SHOW.apps && SHOW.contact, 'the apps and Contact are shown: the tests for their lines cover this page');
        await page.goto(ABOUT.path);
        await settle(page);
        const seen = await page.evaluate(() => ({
            text: document.body.textContent.replace(/\s+/g, ' '),
            hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
        }));
        if (!SHOW.apps) {
            for (const app of APPS) {
                for (const word of [app.shortName, app.name, app.page]) expect.soft(seen.text, `About text holds "${word}"`).not.toContain(word);
            }
            expect.soft(seen.text, 'About text holds "What we\'re making"').not.toContain(ABOUT.makingHeading);
            expect.soft(seen.hrefs.filter((h) => h.includes('/apps')), 'links to app pages').toEqual([]);
            await expect.soft(page.locator('section[aria-labelledby="about-making-title"]'), 'the "What we\'re making" section').toHaveCount(0);
        }
        if (!SHOW.contact) {
            expect.soft(seen.text, 'About text holds the Contact line').not.toContain('Want to say hi');
            expect.soft(seen.text, 'About text holds "Contact page"').not.toContain(ABOUT.contactLink);
            expect.soft(seen.hrefs.filter((h) => h.includes('/contact')), 'links to the Contact page').toEqual([]);
        }
    });

    test('the main text is exactly the approved words, block by block, with nothing added anywhere', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const want = aboutMainText();
        // What a reader sees: one line per block, in order. An extra paragraph
        // anywhere (under the top lines, in the story, in a bio, at the end)
        // adds a line.
        const lines = (await main(page).innerText()).split('\n').map(clean).filter(Boolean);
        expect.soft(lines, 'main, block by block (what the page shows)').toEqual(want);
        // What a crawler or a screen reader gets, hidden text included: the
        // same characters and nothing more (spaces ignored, as textContent
        // does not put any between blocks).
        const squash = (s) => s.replace(/\s+/g, '');
        const all = await main(page).evaluate((el) => el.textContent);
        expect.soft(squash(all), 'main, all text including hidden text').toBe(squash(want.join('')));
    });

    test('no Off-grid badge, legend or popup anywhere on the page', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        await expect.soft(page.locator(TRIGGER), 'Off-grid badges or popup words').toHaveCount(0);
        await expect.soft(page.locator(TIP), 'Off-grid popup boxes').toHaveCount(0);
        await expect.soft(page.locator('[popover], [popovertarget]'), 'popups of any kind').toHaveCount(0);
        await expect.soft(offGridSection(page), 'an "Off-grid, explained" section').toHaveCount(0);
        const text = clean(await page.evaluate(() => document.body.textContent));
        expect.soft(text.match(/off\W?grid/giu) ?? [], 'the word "Off-grid", anywhere in the page').toEqual([]);
        const offGridWords = { popup: WORDS.popup, 'short form': WORDS.shortForm, 'Home legend': WORDS.legendOnHome, 'app-page legend': WORDS.legendOnAppPage };
        for (const [name, words] of Object.entries(offGridWords)) {
            expect.soft(text, `the ${name} words`).not.toContain(words.replace(/^Off-grid: /, ''));
        }
    });

    test('two people blocks, in order, each with photo, name, title and bio', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const blocks = main(page).locator(PEOPLE);
        await expect(blocks).toHaveCount(2);
        for (const [i, person] of ABOUT.people.entries()) {
            const block = blocks.nth(i);
            await expect.soft(block.locator('h3'), `${person.name}: name`).toHaveText(person.name);
            await expect.soft(block.getByText(person.title, { exact: true }), `${person.name}: title`).toHaveCount(1);
            await expect.soft(block.getByText(person.bio, { exact: true }), `${person.name}: bio, word for word`).toHaveCount(1);
            await expect.soft(block.locator('img'), `${person.name}: one photo`).toHaveCount(1);
            const order = await block.evaluate((el) => [...el.querySelectorAll('img, h3, p')].map((e) => e.tagName.toLowerCase()));
            expect.soft(order, `${person.name}: photo, name, title, bio`).toEqual(['img', 'h3', 'p', 'p']);
        }
    });

    test('exactly 2 images on the page, both photos, each with exact alt text and width/height set', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        await expect(page.locator('img'), 'the whole page holds only the two photos').toHaveCount(2);
        const imgs = main(page).locator('img');
        await expect(imgs).toHaveCount(2);
        for (const [i, person] of ABOUT.people.entries()) {
            const img = imgs.nth(i);
            await expect.soft(img, `${person.name}: alt text`).toHaveAttribute('alt', person.alt);
            await expect.soft(img, `${person.name}: width attribute`).toHaveAttribute('width', '240');
            await expect.soft(img, `${person.name}: height attribute`).toHaveAttribute('height', '300');
            expect.soft(await img.getAttribute('src'), `${person.name}: source`).toContain(person.photo);
            expect.soft(await img.getAttribute('srcset'), `${person.name}: no srcset, the file is served as it is`).toBeNull();
            // It loads, at the file's own size (480 x 600). Soft and retried:
            // naturalWidth is 0 until the photo has loaded.
            await expect.soft(img, `${person.name}: loads, 480 wide`).toHaveJSProperty('naturalWidth', ABOUT.photoFile.width);
            await expect.soft(img, `${person.name}: loads, 600 high`).toHaveJSProperty('naturalHeight', ABOUT.photoFile.height);
            const res = await page.request.get(person.photo);
            expect.soft(res.status(), `${person.name}: ${person.photo} status`).toBe(200);
            expect.soft(res.headers()['content-type'], `${person.name}: ${person.photo} type`).toContain('image/webp');
        }
    });

    test('the photos cause no layout jump', async ({ page }) => {
        await page.addInitScript(() => {
            window.__cls = 0;
            new PerformanceObserver((list) => {
                for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
            }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(ABOUT.path);
        await settle(page);
        await page.waitForFunction(() => [...document.images].every((i) => i.complete));
        const boxes = await page.locator('main img').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const after = await page.locator('main img').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect(after, 'photo boxes keep their height after loading').toEqual(boxes);
        expect(await page.evaluate(() => window.__cls), 'cumulative layout shift').toBe(0);
    });

    test('photo size: 240x300 on a computer, 200x250 on a phone; photo tops on one line on a computer', async ({ page }, testInfo) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const shown = isPhone(testInfo) ? ABOUT.shown.phone : ABOUT.shown.desktop;
        const rects = await main(page).locator('img').evaluateAll((els) => els.map((e) => {
            const r = e.getBoundingClientRect();
            return { w: r.width, h: r.height, top: r.top + window.scrollY, left: r.left, right: r.right };
        }));
        expect(rects).toHaveLength(2);
        rects.forEach((r, i) => {
            const who = ABOUT.people[i].name;
            // Within PX_TOLERANCE: the 1px border sits inside the box, so the height is 0.5px short of 5:4 (299.5 / 249.5).
            softPx(r.w, shown.width, `${who}: photo width`);
            softPx(r.h, shown.height, `${who}: photo height`);
        });
        if (isPhone(testInfo)) {
            expect.soft(rects[1].top, 'stacked: the second photo is below the first').toBeGreaterThan(rects[0].top + rects[0].h);
        } else {
            expect.soft(Math.abs(rects[0].top - rects[1].top), 'photo tops on one line').toBeLessThanOrEqual(0.5);
            expect.soft(rects[1].left, 'side by side: the second photo is right of the first').toBeGreaterThanOrEqual(rects[0].right);
        }
    });

    test('side by side on a computer, stacked on a phone (the blocks)', async ({ page }, testInfo) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const [a, b] = await main(page).locator(PEOPLE).evaluateAll((els) => els.map((e) => {
            const r = e.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        }));
        if (isPhone(testInfo)) {
            expect(b.top, 'second block below the first').toBeGreaterThanOrEqual(a.bottom);
            expect(Math.abs(a.left - b.left), 'same left edge').toBeLessThanOrEqual(1);
        } else {
            expect(b.left, 'second block right of the first').toBeGreaterThanOrEqual(a.right);
            expect(Math.abs(a.top - b.top), 'blocks start on one line').toBeLessThanOrEqual(1);
        }
    });

    for (const width of [360, 390, 1280]) {
        test(`no sideways scroll at ${width}px`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'desktop-chromium', 'sets its own widths; one project is enough');
            await page.setViewportSize({ width, height: 900 });
            await page.goto(ABOUT.path);
            await settle(page);
            await page.waitForFunction(() => [...document.images].every((i) => i.complete));
            const m = await page.evaluate(() => ({
                scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, body: document.body.scrollWidth,
            }));
            expect(m.scroll, `page wider than the screen: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.client);
            expect(m.body).toBeLessThanOrEqual(m.client);
            const tops = await main(page).locator('img').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top + window.scrollY));
            if (width >= 768) expect(Math.abs(tops[0] - tops[1]), 'side by side').toBeLessThanOrEqual(0.5);
            else expect(tops[1], 'stacked').toBeGreaterThan(tops[0] + 250);
        });
    }

    test('"What we\'re making": each app name links to its page, with its line', async ({ page }) => {
        test.skip(!SHOW.apps, APPS_PARKED);
        await page.goto(ABOUT.path);
        await settle(page);
        const items = main(page).locator('section[aria-labelledby="about-making-title"] li');
        await expect(items).toHaveCount(APPS.length);
        for (const [i, app] of APPS.entries()) {
            const item = items.nth(i);
            expect.soft(clean(await item.innerText()), `${app.shortName}: the line`).toBe(`${app.name} ${ABOUT.making[app.id]}`);
            await expect.soft(item.locator('a'), `${app.shortName}: link`).toHaveAttribute('href', app.page);
        }
    });

    // One test per app, so a broken link never hides the others.
    for (const app of APPS) {
        test(`"What we're making": the ${app.shortName} link reaches its page`, async ({ page }) => {
            test.skip(!SHOW.apps, APPS_PARKED);
            await page.goto(ABOUT.path);
            await settle(page);
            await main(page).getByRole('link', { name: app.name, exact: true }).click();
            await expect(page, `${app.shortName}: the link reaches its page`).toHaveURL(new RegExp(`${app.page}$`));
            await expect(page.locator('h1'), `${app.shortName}: its page has a heading`).toBeVisible();
        });
    }

    test('the Contact line, word for word, and its link reaches /contact/', async ({ page }) => {
        test.skip(!SHOW.contact, CONTACT_PARKED);
        await page.goto(ABOUT.path);
        await settle(page);
        const link = page.getByRole('link', { name: ABOUT.contactLink, exact: true });
        const p = main(page).locator('p', { has: link });
        await expect(p).toHaveCount(1);
        expect(await p.evaluate((el) => el.textContent)).toBe(ABOUT.contactBefore + ABOUT.contactLink + ABOUT.contactAfter);
        await p.getByRole('link', { name: ABOUT.contactLink, exact: true }).click();
        await expect(page).toHaveURL(/\/contact\/$/);
    });

    // The shown page. The built files, the photo addresses and the file names
    // are checked in checks/about-files.spec.mjs.
    test('"Rabbi", "Fojle" and "Saikat" never appear except inside "Fojle Rabbi Saikat" (text and alt)', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const text = await page.evaluate(() => `${document.body.innerText}\n${[...document.images].map((i) => i.alt).join('\n')}`);
        const stripped = text.split('Fojle Rabbi Saikat').join('');
        for (const part of ['Rabbi', 'Fojle', 'Saikat']) {
            expect.soft(stripped.match(new RegExp(part, 'gi')) ?? [], `"${part}" alone`).toEqual([]);
        }
        expect.soft(text.match(/Fojle Rabbi Saikat/g)?.length ?? 0, 'the full name is there').toBeGreaterThanOrEqual(2);
    });
});
