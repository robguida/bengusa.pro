// The About page (BUWEB-115: "Two developers. Two countries. One team.").
// The words come from support/words.mjs (ABOUT_BLOCKS), never from content/.
// These tests read the RENDERED page, so they do not care where the words
// live in the code. Checks are soft and name the item, so one bad item never
// hides the others.
import { test, expect, isReducedMotion, settle } from '../support/site.mjs';
import { ABOUT, ABOUT_BLOCKS, ABOUT_BANNED, ABOUT_KEPT_TOP_LINE, RABBI_ALONE_LINE, DRAFT_LABEL, APPS } from '../support/words.mjs';
import { SHOW } from '../support/settings.mjs';

// Whitespace and curly quotes made plain, so the markup and the typing style do not matter.
const clean = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const squash = (s) => clean(s).replace(/\s+/g, '');
const main = (page) => page.locator('main');
const kinds = (k) => ABOUT_BLOCKS.filter(([kind]) => kind === k).map(([, t]) => t);

test.describe('About page', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words and layout do not change with motion; the normal pass covers them');
    });

    test('headings: one h1, the h2s and the h3s, word for word, in order', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        await expect.soft(page.locator('h1')).toHaveCount(1);
        const got = async (sel) => (await main(page).locator(sel).allTextContents()).map(clean);
        expect.soft(await got('h1'), 'h1').toEqual(kinds('h1'));
        expect.soft(await got('h2'), 'h2, in order').toEqual(kinds('h2'));
        expect.soft(await got('h3'), 'h3, in order').toEqual(kinds('h3'));
    });

    test('the main text is exactly the approved words, in order, with nothing added', async ({ page }) => {
        test.skip(SHOW.apps || SHOW.contact, 'the apps or Contact are shown: their lines are covered by their own tests');
        await page.goto(ABOUT.path);
        await settle(page);
        // The words of record, plus the one kept top line right after the h1 (see ABOUT_KEPT_TOP_LINE).
        const texts = ABOUT_BLOCKS.map(([, t]) => t);
        const want = squash([texts[0], ABOUT_KEPT_TOP_LINE, ...texts.slice(1)].join(''));
        // What a reader sees, whitespace ignored (a bold label may share a line with its text).
        expect.soft(squash(await main(page).innerText()), 'main, what the page shows').toBe(want);
        // What a crawler or screen reader gets, hidden text included.
        expect.soft(squash(await main(page).evaluate((el) => el.textContent)), 'main, all text including hidden text').toBe(want);
    });

    test('every block is on the page word for word, in order', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const text = clean(await main(page).evaluate((el) => el.innerText));
        let from = 0;
        for (const [kind, t] of ABOUT_BLOCKS) {
            const at = text.indexOf(clean(t), from);
            expect.soft(at, `${kind} "${t.slice(0, 50)}": present, after the block before it`).toBeGreaterThanOrEqual(0);
            if (at >= 0) from = at + clean(t).length;
        }
    });

    test('the bold labels and the closing line are bold', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const labels = ABOUT_BLOCKS.filter(([k]) => k === 'b').map(([, t]) => t);
        const weights = await main(page).evaluate((el, ls) => {
            const norm = (s) => s.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
            return ls.map((l) => {
                const hit = [...el.querySelectorAll('*')].filter((e) => norm(e.textContent) === l).pop();
                return { l, weight: hit ? Number(getComputedStyle(hit).fontWeight) : null };
            });
        }, labels);
        for (const { l, weight } of weights) {
            expect.soft(weight, `"${l}" is its own element`).not.toBeNull();
            if (weight !== null) expect.soft(weight, `"${l}" is bold`).toBeGreaterThanOrEqual(600);
        }
        expect.soft(labels, 'the final story line is a bold line').toContain('Your data, your call.');
    });

    test('banned phrases are nowhere on the page (text and alt text); allowed words do not trip', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const text = clean(await page.evaluate(() => `${document.body.textContent}\n${[...document.images].map((i) => i.alt).join('\n')}`)).toLowerCase();
        for (const phrase of ABOUT_BANNED) expect.soft(text.includes(phrase.toLowerCase()), `banned phrase "${phrase}"`).toBe(false);
        for (const ok of ['client', 'Bangladesh', 'USA', 'AI', 'Off-grid', 'privacy', 'wife']) {
            expect.soft(ABOUT_BANNED.some((b) => ok.toLowerCase().includes(b.toLowerCase())), `allowed word "${ok}" must not match a banned phrase`).toBe(false);
        }
    });

    test('"Rabbi" alone is in the intro line only; everywhere else it is only inside "Fojle Rabbi Saikat"', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const text = clean(await page.evaluate(() => `${document.body.innerText}\n${[...document.images].map((i) => i.alt).join('\n')}`));
        const rest = text.split(clean(RABBI_ALONE_LINE)).join('').split('Fojle Rabbi Saikat').join('');
        expect.soft(text.includes(clean(RABBI_ALONE_LINE)), 'the intro line is there').toBe(true);
        for (const part of ['Rabbi', 'Fojle', 'Saikat']) {
            expect.soft(rest.match(new RegExp(part, 'gi')) ?? [], `"${part}" alone, outside the allowed line`).toEqual([]);
        }
    });

    test('no old words: the placeholder, the draft label and the old story', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        const text = clean(await page.evaluate(() => document.body.textContent));
        for (const gone of [ABOUT.gone, DRAFT_LABEL, 'We build software for a living.', 'Our story', 'Who we are', "Hi. We're bengUSA.pro."]) {
            expect.soft(text, `old words "${gone}"`).not.toContain(gone);
        }
    });

    test('Release 1: no app named or linked on About while the apps are hidden', async ({ page }) => {
        test.skip(SHOW.apps, 'the apps are shown');
        await page.goto(ABOUT.path);
        await settle(page);
        const seen = await page.evaluate(() => ({ text: document.body.textContent.replace(/\s+/g, ' '), hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) }));
        for (const app of APPS) for (const w of [app.shortName, app.name]) expect.soft(seen.text, `About holds "${w}"`).not.toContain(w);
        expect.soft(seen.hrefs.filter((h) => h.includes('/apps')), 'links to app pages').toEqual([]);
    });

    test('four photos in order: each founder headshot first (before his name), his personal photo after, exact alt text', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        await expect(page.locator('img'), 'the whole page holds only the four photos').toHaveCount(4);
        // Phones load lazy photos only near the screen; load all four before checking their size.
        await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
        await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
        const imgs = main(page).locator('img');
        const want = ABOUT.people.flatMap((p) => [[p.name, 'headshot', p.headshot, p.headshotAlt], [p.name, 'personal', p.personal, p.personalAlt]]);
        for (const [i, [who, kind, src, alt]] of want.entries()) {
            const img = imgs.nth(i);
            await expect.soft(img, `${who} ${kind}: alt text`).toHaveAttribute('alt', alt);
            expect.soft(await img.getAttribute('src'), `${who} ${kind}: source`).toContain(src);
            await expect.soft(img, `${who} ${kind}: loads, 480 wide`).toHaveJSProperty('naturalWidth', ABOUT.photoFile.width);
            await expect.soft(img, `${who} ${kind}: loads, 600 high`).toHaveJSProperty('naturalHeight', ABOUT.photoFile.height);
            const res = await page.request.get(src);
            expect.soft(res.status(), `${src} status`).toBe(200);
            expect.soft(res.headers()['content-type'], `${src} type`).toContain('image/webp');
        }
        // Document order: headshot, the name (h3), ..., the own-words label, personal photo.
        const seq = await main(page).evaluate((el) => [...el.querySelectorAll('img, h3')].map((e) => (e.tagName === 'IMG' ? `img:${e.getAttribute('src')}` : `h3:${e.textContent.trim()}`)));
        const expected = ABOUT.people.flatMap((p) => [`img:${p.headshot}`, `h3:${p.name}`, `img:${p.personal}`]);
        const trimmed = seq.map((s) => (s.startsWith('img:') ? s.replace(/^(img:)(.*?)(\/images\/about\/[^?]+).*$/, '$1$3') : s));
        const founders = trimmed.filter((s) => s.startsWith('img:') || ABOUT.people.some((p) => s === `h3:${p.name}`));
        expect.soft(founders, 'photo / name order: headshot, name, personal photo (per founder)').toEqual(expected);
    });

    test('the own-words block comes after the bio and holds the personal photo', async ({ page }) => {
        await page.goto(ABOUT.path);
        await settle(page);
        for (const [i, label] of ["In Rob's own words", 'In his own words'].entries()) {
            const p = ABOUT.people[i];
            const at = await main(page).evaluate((el, [lbl, headshot, personal]) => {
                const all = [...el.querySelectorAll('*')];
                const norm = (s) => s.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
                const lab = all.filter((e) => norm(e.textContent) === lbl).pop();
                const idx = (src) => all.findIndex((e) => e.tagName === 'IMG' && (e.getAttribute('src') || '').includes(src));
                return { lab: lab ? all.indexOf(lab) : -1, head: idx(headshot), pers: idx(personal) };
            }, [label, p.headshot, p.personal]);
            expect.soft(at.lab, `${p.name}: "${label}" label is there`).toBeGreaterThanOrEqual(0);
            expect.soft(at.head, `${p.name}: headshot is before the own-words label`).toBeLessThan(at.lab);
            expect.soft(Math.abs(at.pers - at.lab), `${p.name}: personal photo sits with the own-words block (within 6 elements)`).toBeLessThanOrEqual(6);
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
        await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
        await page.waitForFunction(() => [...document.images].every((i) => i.complete));
        const boxes = await page.locator('main img').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const after = await page.locator('main img').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect(after, 'photo boxes keep their height after loading').toEqual(boxes);
        expect(await page.evaluate(() => window.__cls), 'cumulative layout shift').toBe(0);
    });

    for (const width of [360, 390, 1280]) {
        test(`no sideways scroll at ${width}px`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'desktop-chromium', 'sets its own widths; one project is enough');
            await page.setViewportSize({ width, height: 900 });
            await page.goto(ABOUT.path);
            await settle(page);
            await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
        await page.waitForFunction(() => [...document.images].every((i) => i.complete));
            const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, body: document.body.scrollWidth }));
            expect(m.scroll, `page wider than the screen: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.client);
            expect(m.body).toBeLessThanOrEqual(m.client);
        });
    }
});
