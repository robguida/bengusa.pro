// "Off-grid" and "Cloud-killers" never break across two lines at their hyphen
// (spec 17.a.iv, kept for both brand terms): in the legend (Home's and each
// app page's), in the "Off-grid, explained" heading, in the short line beside
// every badge and in Vault's sync line, on Home and on every app page.
// The words stay byte for byte as approved (no no-break hyphen character);
// the build keeps each term whole with no-wrap text instead.
//
// Two checks, both read from the page:
//   - where it is drawn: every drawn copy of a term sits on one line, at
//     1280px and 390px (the widths the spec names) and at the other widths
//     each screen type is used at;
//   - how it is kept whole: every drawn copy is in no-wrap text, so it holds
//     at any width, not only at the ones measured here.
// Closed popup boxes are not drawn, so they are left out.
import { test, expect, isPhone, isReducedMotion, settle } from '../support/site.mjs';
import { APPS, WORDS } from '../support/words.mjs';
import { EXPLAINED_PARKED, SHOW, SHOW_EXPLAINED } from '../support/settings.mjs';

const WIDTHS = { phone: [390, 320, 360, 375, 414, 430], desktop: [1280, 760, 1024, 1440] };
const TERMS = 'off-grid|cloud-killers';

// Every drawn copy of a term in <main>: how many lines its own letters sit
// on, whether its text is no-wrap, and the paragraph (or heading) it is in.
function termsOnPage(page) {
    return page.evaluate((source) => {
        const norm = (s) => s.replace(/\s+/g, ' ').trim();
        const re = new RegExp(source, 'gi');
        const found = [];
        const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            re.lastIndex = 0;
            for (let m = re.exec(node.data); m; m = re.exec(node.data)) {
                const range = document.createRange();
                range.setStart(node, m.index);
                range.setEnd(node, m.index + m[0].length);
                const rects = [...range.getClientRects()].filter((r) => r.width > 0);
                if (rects.length === 0) continue; // not drawn (a closed popup box)
                const cs = getComputedStyle(node.parentElement);
                const block = node.parentElement.closest('p, h1, h2, h3, li, div');
                found.push({
                    term: m[0],
                    lines: new Set(rects.map((r) => Math.round(r.top))).size,
                    noWrap: cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre' || cs.textWrapMode === 'nowrap',
                    block: block ? norm(block.innerText) : '',
                });
            }
        }
        return found;
    }, TERMS);
}

// The places the spec names, so the check can't pass by finding nothing.
function expectPlaces(found, page) {
    const has = (term, words) => found.some((f) => f.term.toLowerCase() === term && f.block.includes(words));
    if (page === '/') {
        const cards = found.filter((f) => f.term === 'Off-grid' && f.block === WORDS.shortForm).length;
        // The cards are PARKED with the apps (BUWEB-114): Home has the legend only.
        if (SHOW.apps) expect.soft(cards, 'Home: the short line on every badged card').toBeGreaterThanOrEqual(APPS.length);
        // The Home legend, in the "Off-grid, explained" section (13.a.ii).
        const homeLegend = WORDS.legendOnHome.replace(/^Off-grid: /, '');
        expect.soft(has('off-grid', homeLegend), 'Home: "Off-grid" in the legend').toBe(true);
        expect.soft(has('cloud-killers', homeLegend), 'Home: "Cloud-killers" in the legend').toBe(true);
        expect.soft(has('off-grid', WORDS.explainedHeading), 'Home: "Off-grid" in the "Off-grid, explained" heading').toBe(true);
        return;
    }
    const legend = WORDS.legendOnAppPage.replace(/^Off-grid: /, '');
    expect.soft(has('off-grid', legend), `${page}: "Off-grid" in the legend`).toBe(true);
    expect.soft(has('cloud-killers', legend), `${page}: "Cloud-killers" in the legend`).toBe(true);
    expect.soft(has('off-grid', WORDS.shortForm.replace(/^Off-grid: /, '')), `${page}: the short line beside the badge`).toBe(true);
    if (page === APPS.find((a) => a.id === 'vault').page) {
        expect.soft(has('off-grid', WORDS.vaultSync), `${page}: "Off-grid" in the sync line`).toBe(true);
    }
}

test('"Off-grid" and "Cloud-killers" never break at the hyphen: the legend, the short line and the sync line, at 1280px and 390px and the other widths', async ({ page }, testInfo) => {
    test.skip(!SHOW_EXPLAINED, EXPLAINED_PARKED);
    test.skip(isReducedMotion(testInfo), 'line breaks do not change with motion; the normal pass covers them');
    const widths = isPhone(testInfo) ? WIDTHS.phone : WIDTHS.desktop;
    const height = page.viewportSize().height;
    // The app pages are PARKED while the apps are hidden (they are not built).
    for (const p of ['/', ...(SHOW.apps ? APPS.map((a) => a.page) : [])]) {
        await page.setViewportSize({ width: widths[0], height });
        await page.goto(p);
        await settle(page);
        const first = await termsOnPage(page);
        expectPlaces(first, p);
        const loose = first.filter((f) => !f.noWrap).map((f) => `"${f.term}" in "${f.block.slice(0, 60)}"`);
        expect.soft(loose, `${p}: copies of a term that are not kept whole (no no-wrap text)`).toEqual([]);
        for (const w of widths) {
            await page.setViewportSize({ width: w, height });
            await settle(page);
            const split = (await termsOnPage(page)).filter((f) => f.lines > 1)
                .map((f) => `"${f.term}" on ${f.lines} lines in "${f.block.slice(0, 60)}"`);
            expect.soft(split, `${p} at ${w}px: terms split across lines`).toEqual([]);
        }
    }
});
