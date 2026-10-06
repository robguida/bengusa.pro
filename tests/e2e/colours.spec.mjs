// Colour rules for every page (spec 6.f, acceptance check 25.d):
//   - red (#CF2F32) only on the signup button, never as text, never on light blue;
//   - green (#006454) means Off-grid and nothing else (the badge, the hero
//     word, the dotted underline on a popup trigger).
// The logo art keeps its own colours, so it is left out.
//
// The signup button comes with BUWEB-107. Until then there is no red outside
// the logo at all. When it lands, add its hook to RED_ALLOWED and keep the
// "never on light blue" check below green.
import { test, expect, PAGES, isReducedMotion, settle } from '../support/site.mjs';
import { TRIGGER, expectOpen, popupsLive, press, tipOf } from '../support/offgrid.mjs';
import { COLOUR } from '../support/words.mjs';

const LOGO = '[data-logo]';
const RED_ALLOWED = []; // e.g. '[data-signup="submit"]' once BUWEB-107 builds the button
const GREEN_ALLOWED = [TRIGGER]; // the badge, the hero word and every popup trigger's underline

// Every colour each element (and its ::before / ::after) actually paints:
// text (only where it has text of its own), background, borders and outline
// (only when drawn), underline, SVG fill and stroke, and box shadows.
// Returns the elements that paint `rgb` outside the allowed selectors.
function findColour(page, rgb, allowed, root = 'body') {
    return page.evaluate(({ rgb, allowed, logo, root }) => {
        const want = rgb.replace(/\s+/g, '');
        const same = (v) => typeof v === 'string' && v.replace(/\s+/g, '').includes(want);
        const hits = [];
        const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : ''}`;
        const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        const check = (el, cs, pseudo) => {
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            const where = `${name(el)}${pseudo}`;
            const painted = [];
            if ((pseudo ? cs.content !== 'none' && cs.content !== 'normal' && cs.content !== '""' : ownText(el)) && same(cs.color)) painted.push('text');
            if (same(cs.backgroundColor)) painted.push('background');
            for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
                if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && same(cs[`border${side}Color`])) painted.push(`border-${side.toLowerCase()}`);
            }
            if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none' && same(cs.outlineColor)) painted.push('outline');
            if (cs.textDecorationLine !== 'none' && same(cs.textDecorationColor)) painted.push('underline');
            if (el instanceof SVGElement && cs.fill !== 'none' && same(cs.fill)) painted.push('fill');
            if (el instanceof SVGElement && cs.stroke !== 'none' && same(cs.stroke)) painted.push('stroke');
            if (cs.boxShadow !== 'none' && same(cs.boxShadow)) painted.push('shadow');
            if (painted.length) hits.push(`${where}: ${painted.join(', ')}`);
        };
        const scope = document.querySelector(root);
        for (const el of [scope, ...scope.querySelectorAll('*')]) {
            if (el.closest(logo) || allowed.some((sel) => el.closest(sel))) continue;
            check(el, getComputedStyle(el), '');
            check(el, getComputedStyle(el, '::before'), '::before');
            check(el, getComputedStyle(el, '::after'), '::after');
        }
        return hits;
    }, { rgb, allowed, logo: LOGO, root });
}

test.describe('colour rules (6.f)', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'colours do not change with motion; the normal pass covers them');
    });

    test('red only on the signup button, green only for Off-grid, on every page', async ({ page }) => {
        for (const p of PAGES) {
            await page.goto(p);
            await settle(page);
            expect.soft(await findColour(page, COLOUR.red, RED_ALLOWED), `${p}: red outside the signup button`).toEqual([]);
            expect.soft(await findColour(page, COLOUR.green, GREEN_ALLOWED), `${p}: green outside Off-grid`).toEqual([]);
        }
    });

    test('an open popup is a navy box with white words, "Off-grid:" bold white, and no green', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        for (const sel of [`h1 ${TRIGGER}`, `#apps article ${TRIGGER}`]) {
            const trigger = page.locator(sel).first();
            const tip = await tipOf(page, trigger);
            await press(trigger, testInfo);
            await expectOpen(trigger, tip, sel);
            const look = await tip.evaluate((el) => {
                const cs = getComputedStyle(el);
                const b = getComputedStyle(el.querySelector('b'));
                const a = el.querySelector('a');
                return {
                    box: cs.backgroundColor,
                    words: cs.color,
                    lead: b.color,
                    leadBold: Number(b.fontWeight) >= 700,
                    link: a ? getComputedStyle(a).color : null,
                };
            });
            expect.soft(look, `${sel}: popup colours (17.c.vi)`).toEqual({
                box: COLOUR.navy, words: COLOUR.white, lead: COLOUR.white, leadBold: true,
                link: sel.startsWith('h1') ? null : COLOUR.white, // the hero popup has no link; a card's link is white
            });
            const tipSel = `[id="${await tip.getAttribute('id')}"]`;
            expect.soft(await findColour(page, COLOUR.green, [], tipSel), `${sel}: green inside the open popup`).toEqual([]);
            await page.keyboard.press('Escape');
        }
    });
});
