// The Off-grid app pages (spec 13.a.ii, 13.b, 13.d.i, 13.e.ii; acceptance
// checks 3, 3.a, 3.c). The words come from support/words.mjs (copied from the
// spec), never from content/.
import { test, expect, isReducedMotion, settle } from '../support/site.mjs';
import { TRIGGER } from '../support/offgrid.mjs';
import { APPS, WORDS } from '../support/words.mjs';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

test.describe('app pages', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words and order do not change with motion; the normal pass covers them');
    });

    for (const app of APPS) {
        test(`${app.shortName}: badge and short form, then the legend with its connects box directly below`, async ({ page }) => {
            await page.goto(app.page);
            await settle(page);
            const main = page.locator('main');
            expect.soft(clean(await main.evaluate((el) => el.innerText)), 'short form near the top').toContain(WORDS.shortForm);
            await expect.soft(main.locator(TRIGGER), 'two badges: the intro and the legend').toHaveCount(2);

            const found = await page.evaluate(({ legend, box }) => {
                const norm = (s) => s.replace(/\s+/g, ' ').trim();
                const ps = [...document.querySelectorAll('main p')];
                const legendEl = ps.find((p) => norm(p.innerText).includes(legend.slice(0, 40)));
                const boxEl = document.getElementById(box);
                return {
                    legend: legendEl ? norm(legendEl.innerText.replace(/^Off-grid\s*/, '')) : null,
                    box: boxEl ? norm(boxEl.innerText) : null,
                    directlyBelow: !!legendEl && !!boxEl && legendEl.nextElementSibling === boxEl,
                };
            }, { legend: WORDS.legendOnAppPage, box: app.box });
            expect.soft(found.legend, 'the legend, word for word').toBe(WORDS.legendOnAppPage);
            expect.soft(found.box, `the connects box (#${app.box}), word for word`).toBe(WORDS.connects[app.id]);
            expect.soft(found.directlyBelow, 'the connects box sits directly below the legend, nothing between').toBe(true);
        });
    }

    test('Vault: the legend, then the connects box, then the sync line, then the trust line, in that order', async ({ page }) => {
        const vault = APPS.find((a) => a.id === 'vault');
        await page.goto(vault.page);
        await settle(page);
        const parts = await page.evaluate(({ legend, box, sync, trust }) => {
            const norm = (s) => s.replace(/\s+/g, ' ').trim();
            const all = [...document.querySelectorAll('main p, main div')];
            const find = (words) => all.filter((el) => norm(el.innerText).includes(words))
                .sort((a, b) => (a.contains(b) ? 1 : b.contains(a) ? -1 : 0))[0]; // the innermost match
            const legendEl = find(legend.slice(0, 60));
            const boxEl = document.getElementById(box);
            const syncEl = find(sync);
            const trustEl = find(trust);
            const els = { legend: legendEl, box: boxEl, sync: syncEl, trust: trustEl };
            const missing = Object.entries(els).filter(([, el]) => !el).map(([k]) => k);
            if (missing.length) return { missing };
            const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            const top = (el) => el.getBoundingClientRect().top + window.scrollY;
            const legendSection = legendEl.closest('section');
            return {
                missing,
                domOrder: before(legendEl, boxEl) && before(boxEl, trustEl) && before(trustEl, syncEl),
                screenOrder: top(legendEl) < top(boxEl) && top(boxEl) < top(trustEl) && top(trustEl) < top(syncEl),
                syncInLegend: legendEl.contains(syncEl) || legendSection.contains(syncEl),
                syncText: norm(syncEl.innerText),
                trustText: norm(trustEl.innerText),
                cloudKillers: (norm(document.querySelector('main').innerText).match(/Cloud-killers/g) || []).length,
                cloudKillersInLegend: (norm(legendEl.innerText).match(/Cloud-killers/g) || []).length,
            };
        }, { legend: WORDS.legendOnAppPage, box: vault.box, sync: WORDS.vaultSync, trust: WORDS.vaultTrust });
        expect(parts.missing, 'parts found on the Vault page').toEqual([]);
        expect.soft(parts.syncText, 'sync line, word for word').toBe(WORDS.vaultSync);
        expect.soft(parts.trustText, 'trust line, word for word').toBe(WORDS.vaultTrust);
        expect.soft(parts.domOrder, 'page order: legend, box, sync line, trust line').toBe(true);
        expect.soft(parts.screenOrder, 'on screen, top to bottom: legend, box, sync line, trust line').toBe(true);
        expect.soft(parts.syncInLegend, 'the sync line is never inside the legend or its section (13.d.i)').toBe(false);
        // 13.d.i / acceptance 3.c: on Vault, "Cloud-killers" is in the legend only.
        expect.soft(parts.cloudKillers, '"Cloud-killers" on the Vault page').toBe(1);
        expect.soft(parts.cloudKillersInLegend, '"Cloud-killers" in the legend').toBe(1);
    });
});
