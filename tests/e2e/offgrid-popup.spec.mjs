// The Off-grid popup (spec 17.c, acceptance check 25.c). Every wait is on page
// state (data-state, aria-expanded, :popover-open, focus), never a set time.
// See support/offgrid.mjs for the hooks.
import { test, expect, isPhone, isReducedMotion, settle, tabBottom } from '../support/site.mjs';
import {
    TIP, TRIGGER, centre, expectClosed, expectOpen, isShowing, popupsLive, press, pressAt, tipOf, tipWords,
} from '../support/offgrid.mjs';
import { APPS, WORDS, connectsLabel } from '../support/words.mjs';

// Where every popup is, and what its link must be (17.c.ii, 17.c.iv): the hero
// and heading words have no link; a badge links to its own app's box.
const WHERE = [
    {
        page: '/',
        popups: [
            { where: 'h1', link: null },
            { where: 'h2#apps-title', link: null },
            ...APPS.map((app) => ({ where: `card ${app.shortName}`, link: app })),
        ],
    },
    ...APPS.map((app) => ({ page: app.page, popups: [{ where: 'intro badge', link: app }, { where: 'legend badge', link: app }] })),
];

// The trigger in the hero, and the Vault card's badge (it has a link).
const heroTrigger = (page) => page.locator(`h1 ${TRIGGER}`);
const headingTrigger = (page) => page.locator(`h2#apps-title ${TRIGGER}`);
const vaultCardTrigger = (page) => page.locator('#apps article').filter({ hasText: 'Vault' }).locator(TRIGGER);

test.describe('the Off-grid popup', () => {
    test('every popup shows the approved words exactly; a badge popup links to its own app\'s box', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words do not change with motion; the normal pass covers them');
        for (const { page: p, popups } of WHERE) {
            await page.goto(p);
            await popupsLive(page);
            const triggers = page.locator(TRIGGER);
            await expect(triggers, `${p}: number of popups`).toHaveCount(popups.length);
            for (const [i, want] of popups.entries()) {
                const label = `${p} ${want.where}`;
                const trigger = triggers.nth(i);
                await expect(trigger, `${label}: trigger words`).toHaveText(WORDS.offGridWord);
                const tip = await tipOf(page, trigger);
                expect(await tipWords(tip), `${label}: popup words`).toBe(WORDS.popup);
                await expect(tip.locator('b'), `${label}: bold lead`).toHaveText('Off-grid:');
                const links = tip.locator('a');
                if (!want.link) {
                    await expect(links, `${label}: no link`).toHaveCount(0);
                } else {
                    await expect(links, `${label}: one link`).toHaveCount(1);
                    await expect(links, `${label}: link label`).toHaveText(connectsLabel(want.link));
                    await expect(links, `${label}: link target`).toHaveAttribute('href', `${want.link.page}#${want.link.box}`);
                }
            }
        }
        // Where the hero, heading and card popups sit on Home.
        await page.goto('/');
        await popupsLive(page);
        await expect(heroTrigger(page)).toHaveCount(1);
        await expect(headingTrigger(page)).toHaveCount(1);
        for (const app of APPS) {
            await expect(page.locator('#apps article').filter({ hasText: app.shortName }).locator(TRIGGER), `${app.shortName} card badge`).toHaveCount(1);
        }
    });

    test('hover opens it; moving the mouse away closes it', async ({ page }, testInfo) => {
        test.skip(isPhone(testInfo), 'phones have no hover; tap is tested below');
        await page.goto('/');
        await popupsLive(page);
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
            await centre(page, trigger);
            const tip = await tipOf(page, trigger);
            await expectClosed(trigger, tip, `${name} before hover`);
            await trigger.hover();
            await expectOpen(trigger, tip, `${name} on hover`);
            // Far from the trigger and the box (the box opens below the trigger).
            await page.mouse.move(2, 2);
            await expectClosed(trigger, tip, `${name} after the mouse left`);
        }
    });

    test('keyboard focus opens it; moving focus away closes it', async ({ page }) => {
        await page.goto('/');
        await popupsLive(page);
        const trigger = heroTrigger(page);
        const tip = await tipOf(page, trigger);
        // Tab from the top of the page until the hero word has focus. Each
        // press is checked; there is no wait in between.
        let reached = false;
        for (let i = 0; i < 30 && !reached; i++) {
            await page.keyboard.press('Tab');
            reached = await trigger.evaluate((el) => el === document.activeElement);
        }
        expect(reached, 'Tab reaches the hero word').toBe(true);
        await expectOpen(trigger, tip, 'hero word focused by Tab');
        // Back to the header (not on to the heading word: opening that popup
        // would close this one anyway, so a broken blur would still pass).
        await page.keyboard.press('Shift+Tab');
        await expect(trigger).not.toBeFocused();
        expect(await page.evaluate(() => !!document.activeElement.closest('header')), 'focus is back in the header').toBe(true);
        await expectClosed(trigger, tip, 'hero word after focus moved away');
    });

    test('a tap or click opens it; a second one closes it', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
            await centre(page, trigger);
            const tip = await tipOf(page, trigger);
            await press(trigger, testInfo);
            await expectOpen(trigger, tip, `${name} after a tap`);
            await press(trigger, testInfo);
            await expectClosed(trigger, tip, `${name} after a second tap`);
        }
    });

    test('Esc closes it and puts focus back on its button', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);

        // A badge popup with a link: move focus INTO the box first, so a
        // broken "focus goes back" cannot pass by focus never having left.
        const badge = vaultCardTrigger(page);
        await centre(page, badge);
        const badgeTip = await tipOf(page, badge);
        await press(badge, testInfo);
        await expectOpen(badge, badgeTip, 'Vault badge');
        const link = badgeTip.getByRole('link', { name: connectsLabel(APPS[2]) });
        await link.focus();
        await expect(link).toBeFocused();
        await expectOpen(badge, badgeTip, 'Vault badge, focus on its link');
        await page.keyboard.press('Escape');
        await expectClosed(badge, badgeTip, 'Vault badge after Esc');
        await expect(badge, 'focus back on the Vault badge').toBeFocused();

        // The hero popup has no link: focus the box itself.
        const hero = heroTrigger(page);
        await centre(page, hero);
        const heroTip = await tipOf(page, hero);
        await press(hero, testInfo);
        await expectOpen(hero, heroTip, 'hero word');
        await heroTip.focus();
        await expect(heroTip).toBeFocused();
        await page.keyboard.press('Escape');
        await expectClosed(hero, heroTip, 'hero word after Esc');
        await expect(hero, 'focus back on the hero word').toBeFocused();

        // Opened by keyboard focus: Esc closes it and focus stays put. Tab on
        // to the heading word, then Shift+Tab back, so the hero word gets
        // keyboard focus again.
        await page.keyboard.press('Tab');
        await expect(headingTrigger(page)).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(hero).toBeFocused();
        await expectOpen(hero, heroTip, 'hero word focused by keyboard');
        await page.keyboard.press('Escape');
        await expectClosed(hero, heroTip, 'hero word after Esc (keyboard)');
        await expect(hero).toBeFocused();
    });

    test('a tap or click outside closes it', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        const subline = page.locator('h1 + p');
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
            await centre(page, trigger);
            const tip = await tipOf(page, trigger);
            await press(trigger, testInfo);
            await expectOpen(trigger, tip, name);
            // A spot on the page that is neither the trigger nor the box, and
            // not a link or button: the far left of the screen, level with
            // the trigger's middle row of the page.
            const t = await trigger.boundingBox();
            const box = await tip.boundingBox();
            const x = 4;
            const y = t.y + t.height / 2;
            expect(x < box.x && x < t.x, `${name}: the outside spot is clear of the box and the trigger`).toBe(true);
            const hit = await page.evaluate(([px, py]) => {
                const el = document.elementFromPoint(px, py);
                return el ? (el.closest('a, button, [data-offgrid]') ? 'interactive' : 'plain') : 'nothing';
            }, [x, y]);
            expect(hit, `${name}: the outside spot is plain page`).toBe('plain');
            await pressAt(page, testInfo, x, y);
            await expectClosed(trigger, tip, `${name} after a tap outside`);
        }
        await expect(subline).toBeVisible(); // still on Home: the outside taps hit nothing that navigates
    });

    test('opening it moves nothing on the page, and the box stays inside the screen', async ({ page }, testInfo) => {
        for (const p of ['/', APPS[2].page]) {
            await page.goto(p);
            await popupsLive(page);
            const triggers = page.locator(TRIGGER);
            const count = await triggers.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                const trigger = triggers.nth(i);
                const label = `${p} popup ${i + 1}`;
                await centre(page, trigger);
                const tip = await tipOf(page, trigger);
                const before = await layout(page);
                await press(trigger, testInfo);
                await expectOpen(trigger, tip, label);
                await settle(page);
                const after = await layout(page);
                expect.soft(after.scroll, `${label}: scroll position and page size`).toEqual(before.scroll);
                expect.soft(moved(before.boxes, after.boxes), `${label}: page parts that moved or changed size`).toEqual([]);
                const fit = await tip.evaluate((el) => {
                    const r = el.getBoundingClientRect();
                    return { left: r.left, right: r.right, width: document.documentElement.clientWidth, position: getComputedStyle(el).position };
                });
                expect.soft(fit.position, `${label}: box is fixed, out of the page flow`).toBe('fixed');
                expect.soft(fit.left, `${label}: box left edge on screen`).toBeGreaterThanOrEqual(0);
                expect.soft(fit.right, `${label}: box right edge on screen`).toBeLessThanOrEqual(fit.width);
                await page.keyboard.press('Escape');
                await expectClosed(trigger, tip, `${label} closed`);
            }
        }
    });

    test('one box open at a time', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        const hero = heroTrigger(page);
        const heading = headingTrigger(page);
        const heroTip = await tipOf(page, hero);
        const headingTip = await tipOf(page, heading);
        await centre(page, heading);
        await press(hero, testInfo);
        await expectOpen(hero, heroTip, 'hero word');
        await press(heading, testInfo);
        await expectOpen(heading, headingTip, 'heading word');
        await expectClosed(hero, heroTip, 'hero word once the heading popup opened');
        await expect(page.locator(`${TIP}[data-state="open"]`)).toHaveCount(1);
    });

    test('the box fades in with motion on, and does not animate at all with reduce-motion', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        const trigger = heroTrigger(page);
        const tip = await tipOf(page, trigger);
        await press(trigger, testInfo);
        await expectOpen(trigger, tip, 'hero word');
        const motion = await tip.evaluate((el) => ({
            name: getComputedStyle(el).animationName,
            running: el.getAnimations().length,
            transition: getComputedStyle(el).transitionDuration,
        }));
        expect(motion.transition, 'no transition on the box').toMatch(/^0s(, 0s)*$/);
        if (isReducedMotion(testInfo)) {
            expect(motion.name, 'reduce-motion: no animation on the box').toBe('none');
            expect(motion.running, 'reduce-motion: animations running on the box').toBe(0);
        } else {
            // The control: with motion on, this same read does see the fade,
            // so the reduce-motion read above is not blind.
            expect(motion.name, 'motion on: the box has its fade').not.toBe('none');
        }
    });
});

test.describe('the Off-grid popup with scripts off', () => {
    test.use({ javaScriptEnabled: false });

    test('its words are in the page, and the browser\'s own popover opens and closes it', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'no script runs, so motion changes nothing here; the normal pass covers it');
        for (const { page: p, popups } of WHERE) {
            await page.goto(p);
            const triggers = page.locator(TRIGGER);
            await expect(triggers, `${p}: number of popups`).toHaveCount(popups.length);
            for (let i = 0; i < popups.length; i++) {
                const trigger = triggers.nth(i);
                const tip = await tipOf(page, trigger);
                await expect(trigger, `${p} popup ${i + 1}: no script state`).not.toHaveAttribute('data-state');
                await expect(trigger, `${p} popup ${i + 1}: browser popover switch`).toHaveAttribute('popovertarget', await tip.getAttribute('id'));
                expect(await tipWords(tip), `${p} popup ${i + 1}: words in the page`).toBe(WORDS.popup);
            }
        }

        await page.goto('/');
        const trigger = heroTrigger(page);
        const tip = await tipOf(page, trigger);
        await centre(page, trigger);
        await press(trigger, testInfo);
        await expect.poll(() => isShowing(tip), 'a tap opens it').toBe(true);
        await expect(tip).toBeVisible();
        await expect(tip).toContainText(WORDS.popup);
        await page.keyboard.press('Escape');
        await expect.poll(() => isShowing(tip), 'Esc closes it').toBe(false);
        await expect(tip).toBeHidden();

        await press(trigger, testInfo);
        await expect.poll(() => isShowing(tip), 'a tap opens it again').toBe(true);
        await pressAt(page, testInfo, 4, (await page.locator('h1 + p').boundingBox()).y + 4);
        await expect.poll(() => isShowing(tip), 'a tap outside closes it').toBe(false);
    });
});

test('a badge popup\'s link goes to that app\'s box, below the header', async ({ page }, testInfo) => {
    test.skip(isReducedMotion(testInfo), 'navigation does not change with motion; the normal pass covers it');
    const vault = APPS[2];
    await page.goto('/');
    await popupsLive(page);
    const trigger = vaultCardTrigger(page);
    await centre(page, trigger);
    const tip = await tipOf(page, trigger);
    await press(trigger, testInfo);
    await expectOpen(trigger, tip, 'Vault badge');
    await press(tip.getByRole('link', { name: connectsLabel(vault) }), testInfo);
    await expect(page).toHaveURL((url) => url.pathname === vault.page && url.hash === `#${vault.box}`);
    const box = page.locator(`[id="${vault.box}"]`);
    await expect(box).toBeInViewport();
    await settle(page);
    const boxTop = await box.evaluate((el) => el.getBoundingClientRect().top);
    const headerBottom = await tabBottom(page);
    expect(boxTop, 'the box starts below the header\'s tab').toBeGreaterThanOrEqual(headerBottom);
    await expect(box).toContainText(WORDS.connects.vault);
});

// Every element in the page's main and footer: where it is and how big, in
// page coordinates. Leaves out the popup boxes themselves (they open in the
// top layer, out of the page flow).
async function layout(page) {
    return page.evaluate((tipSel) => {
        const boxes = {};
        const all = document.querySelectorAll('main *, footer *');
        all.forEach((el, i) => {
            if (el.closest(tipSel)) return;
            const r = el.getBoundingClientRect();
            boxes[`${i}:${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`] = [r.left + window.scrollX, r.top + window.scrollY, r.width, r.height];
        });
        const d = document.documentElement;
        return { boxes, scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY), width: d.scrollWidth, height: d.scrollHeight } };
    }, TIP);
}

function moved(before, after) {
    const out = [];
    for (const [key, a] of Object.entries(before)) {
        const b = after[key];
        if (!b) out.push(`${key}: gone`);
        else if (a.some((v, i) => Math.abs(v - b[i]) > 0.5)) out.push(`${key}: ${a.map((v) => v.toFixed(1))} -> ${b.map((v) => v.toFixed(1))}`);
    }
    return out;
}
