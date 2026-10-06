// The Off-grid popup (spec 17.c, acceptance check 25.c). Every wait is on page
// state (data-state, aria-expanded, :popover-open, focus), never a set time.
// The mouse tests drive the page's own 150 ms / 300 ms timers with Playwright's
// fake clock instead of waiting for them. See support/offgrid.mjs for the hooks.
import { test, expect, heroSubline, isPhone, isReducedMotion, settle, tabBottom } from '../support/site.mjs';
import {
    CLOSE_GRACE_MS, OPEN_DELAY_MS, TIP, TRIGGER, centre, expectClosed, expectOpen, expectStillOpen, freeze, isShowing, middle,
    offGridSection, popupsLive, press, pressAt, softTipOf, tipOf, tipWords,
} from '../support/offgrid.mjs';
import { APPS, WORDS, connectsLabel } from '../support/words.mjs';

// Where every popup is, in page order, and what its link must be (17.c.ii,
// 17.c.iv): the hero and heading words have no link, and neither has the
// badge in Home's "Off-grid, explained" section (it names no single app);
// every other badge links to its own app's box.
const WHERE = [
    {
        page: '/',
        popups: [
            { where: 'h1', link: null },
            { where: 'Off-grid section badge', link: null },
            { where: 'h2#apps-title', link: null },
            ...APPS.map((app) => ({ where: `card ${app.shortName}`, link: app })),
        ],
    },
    ...APPS.map((app) => ({ page: app.page, popups: [{ where: 'intro badge', link: app }, { where: 'legend badge', link: app }] })),
];

// The trigger in the hero, the badge in Home's "Off-grid, explained" section
// (no link), the grid heading's word, and the Vault card's badge (it has a link).
const heroTrigger = (page) => page.locator(`h1 ${TRIGGER}`);
const sectionTrigger = (page) => offGridSection(page).locator(TRIGGER);
const headingTrigger = (page) => page.locator(`h2#apps-title ${TRIGGER}`);
const vaultCardTrigger = (page) => page.locator('#apps article').filter({ hasText: 'Vault' }).locator(TRIGGER);

test.describe('the Off-grid popup', () => {
    test('every popup shows the approved words exactly; a badge popup links to its own app\'s box', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'words do not change with motion; the normal pass covers them');
        // Soft checks all the way down: one bad popup is reported, and every
        // other popup on every page is still checked.
        for (const { page: p, popups } of WHERE) {
            await page.goto(p);
            await popupsLive(page);
            const triggers = page.locator(TRIGGER);
            await expect.soft(triggers, `${p}: number of popups`).toHaveCount(popups.length);
            // With the wrong number, the list below would pair the wrong
            // popups with the wrong names: report it and go on to the next page.
            if (await triggers.count() !== popups.length) continue;
            for (const [i, want] of popups.entries()) {
                const label = `${p} ${want.where}`;
                const trigger = triggers.nth(i);
                await expect.soft(trigger, `${label}: trigger words`).toHaveText(WORDS.offGridWord);
                const found = await softTipOf(page, trigger, label);
                if (!found) continue;
                const { tip } = found;
                expect.soft(await tipWords(tip), `${label}: popup words`).toBe(WORDS.popup);
                await expect.soft(tip.locator('b'), `${label}: bold lead`).toHaveText('Off-grid:');
                const links = tip.locator('a');
                if (!want.link) {
                    await expect.soft(links, `${label}: no link`).toHaveCount(0);
                } else {
                    await expect.soft(links, `${label}: one link`).toHaveCount(1);
                    await expect.soft(links, `${label}: link label`).toHaveText(connectsLabel(want.link));
                    await expect.soft(links, `${label}: link target`).toHaveAttribute('href', `${want.link.page}#${want.link.box}`);
                }
            }
        }
        // Where the hero, section badge, heading and card popups sit on Home.
        await page.goto('/');
        await popupsLive(page);
        await expect(heroTrigger(page)).toHaveCount(1);
        await expect(sectionTrigger(page), 'the badge in the "Off-grid, explained" section').toHaveCount(1);
        await expect(headingTrigger(page)).toHaveCount(1);
        for (const app of APPS) {
            await expect(page.locator('#apps article').filter({ hasText: app.shortName }).locator(TRIGGER), `${app.shortName} card badge`).toHaveCount(1);
        }
    });

    test('hover opens it; moving the mouse away closes it', async ({ page }, testInfo) => {
        test.skip(isPhone(testInfo), 'phones have no hover; tap is tested below');
        await page.goto('/');
        await popupsLive(page);
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['section badge', sectionTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
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
        // Back to the header (not on to the next popup button: opening that
        // popup would close this one anyway, so a broken blur would still pass).
        await page.keyboard.press('Shift+Tab');
        await expect(trigger).not.toBeFocused();
        expect(await page.evaluate(() => !!document.activeElement.closest('header')), 'focus is back in the header').toBe(true);
        await expectClosed(trigger, tip, 'hero word after focus moved away');
    });

    test('a tap or click opens it; a second one closes it', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['section badge', sectionTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
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
        // to the next popup button, the badge in the "Off-grid, explained"
        // section (it comes straight after the hero), then Shift+Tab back,
        // so the hero word gets keyboard focus again.
        const section = sectionTrigger(page);
        const sectionTip = await tipOf(page, section);
        await page.keyboard.press('Tab');
        await expect(section, 'Tab from the hero word lands on the section badge').toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(hero).toBeFocused();
        await expectOpen(hero, heroTip, 'hero word focused by keyboard');
        await page.keyboard.press('Escape');
        await expectClosed(hero, heroTip, 'hero word after Esc (keyboard)');
        await expect(hero).toBeFocused();

        // The section badge, opened by keyboard focus: Esc closes it, and
        // focus stays on it.
        await page.keyboard.press('Tab');
        await expect(section).toBeFocused();
        await expectOpen(section, sectionTip, 'section badge focused by keyboard');
        await page.keyboard.press('Escape');
        await expectClosed(section, sectionTip, 'section badge after Esc (keyboard)');
        await expect(section).toBeFocused();

        // The section badge's popup has no link, like the hero's: focus the
        // box itself, then Esc puts focus back on the badge.
        await centre(page, section);
        await press(section, testInfo);
        await expectOpen(section, sectionTip, 'section badge');
        await sectionTip.focus();
        await expect(sectionTip).toBeFocused();
        await page.keyboard.press('Escape');
        await expectClosed(section, sectionTip, 'section badge after Esc');
        await expect(section, 'focus back on the section badge').toBeFocused();
    });

    test('a tap or click outside closes it', async ({ page }, testInfo) => {
        await page.goto('/');
        await popupsLive(page);
        const subline = heroSubline(page);
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['section badge', sectionTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
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

// WCAG 1.4.13 "hoverable" (spec 17.c.v): the mouse can move from the trigger
// into its box, across the gap between them, and the box stays open; and a
// click on a box opened by hover keeps it open. The page's fake clock stands
// in for its 150 ms open delay and 300 ms grace: once frozen, the page's time
// moves only when the test calls runFor(), so nothing here waits a real
// 300 ms, and a box that wrongly closes after its grace closes every time.
test.describe('the Off-grid popup and the mouse, on a fake clock', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(isPhone(testInfo), 'phones have no hover; tap is tested above');
        await page.clock.install(); // time still flows until freeze()
        await page.goto('/');
        await popupsLive(page);
    });

    // Opens the popup by hover alone, on a frozen clock.
    async function openByHover(page, trigger, tip, name) {
        await centre(page, trigger); // needs running time: before freeze()
        await expectClosed(trigger, tip, `${name} before hover`);
        await freeze(page);
        const at = await middle(trigger);
        await page.mouse.move(at.x, at.y);
        await page.clock.runFor(OPEN_DELAY_MS + 50);
        await expectOpen(trigger, tip, `${name} opened by hover`);
    }

    test('the mouse can move from the trigger into its box, and the box stays open past the 300 ms grace', async ({ page }) => {
        for (const [name, trigger] of [['hero word', heroTrigger(page)], ['section badge', sectionTrigger(page)], ['Vault badge', vaultCardTrigger(page)]]) {
            const tip = await tipOf(page, trigger);
            await openByHover(page, trigger, tip, name);
            // Into the box, in small steps, so the pointer crosses the gap
            // and leaves the trigger before it reaches the box.
            const inBox = await middle(tip.locator('b'));
            await page.mouse.move(inBox.x, inBox.y, { steps: 8 });
            await page.clock.runFor(CLOSE_GRACE_MS + 100);
            await expectStillOpen(trigger, tip, `${name}: mouse in the box, past the grace`);
            const link = tip.locator('a');
            if (await link.count()) {
                // The badge box's link: the reason to move into the box at all.
                const onLink = await middle(link);
                await page.mouse.move(onLink.x, onLink.y, { steps: 4 });
                await page.clock.runFor(CLOSE_GRACE_MS + 100);
                await expectStillOpen(trigger, tip, `${name}: mouse on the box's link, past the grace`);
            }
            // The control: leaving both closes it, but only once the grace is
            // over. Seen open with no time gone, then closed after it.
            await page.mouse.move(2, 2);
            expect(await isShowing(tip), `${name}: still open inside the grace`).toBe(true);
            await page.clock.runFor(CLOSE_GRACE_MS + 100);
            await expectClosed(trigger, tip, `${name}: mouse gone from the trigger and the box, past the grace`);
            await page.clock.resume();
        }
    });

    test('a click on a box opened by hover keeps it open', async ({ page }) => {
        // A click on the trigger pins the box: the mouse leaving no longer closes it.
        const hero = heroTrigger(page);
        const heroTip = await tipOf(page, hero);
        await openByHover(page, hero, heroTip, 'hero word');
        const at = await middle(hero);
        await page.mouse.click(at.x, at.y);
        await expectStillOpen(hero, heroTip, 'hero word, clicked after hover opened it');
        await page.mouse.move(2, 2);
        await page.clock.runFor(CLOSE_GRACE_MS + 100);
        await expectStillOpen(hero, heroTip, 'hero word, clicked, then the mouse left, past the grace');
        // A second click closes it, ready for the next part. Not Esc: the
        // page adds its Esc listener a step after the box shows as open, and
        // on a slow machine that step can still be pending here.
        await page.mouse.click(at.x, at.y);
        await expectClosed(hero, heroTip, 'hero word after a second click');
        await page.clock.resume();

        // A click inside the box (on its words, not its link) keeps it open too.
        const badge = vaultCardTrigger(page);
        const badgeTip = await tipOf(page, badge);
        await openByHover(page, badge, badgeTip, 'Vault badge');
        const inBox = await middle(badgeTip.locator('b'));
        await page.mouse.move(inBox.x, inBox.y, { steps: 8 });
        await page.mouse.click(inBox.x, inBox.y);
        await page.clock.runFor(CLOSE_GRACE_MS + 100);
        await expectStillOpen(badge, badgeTip, 'Vault badge, clicked inside its box, past the grace');
        await expect(page, 'a click on the box\'s words goes nowhere').toHaveURL((url) => url.pathname === '/');
    });
});

test.describe('the Off-grid popup with scripts off', () => {
    test.use({ javaScriptEnabled: false });

    test('its words are in the page, and the browser\'s own popover opens and closes it', async ({ page }, testInfo) => {
        test.skip(isReducedMotion(testInfo), 'no script runs, so motion changes nothing here; the normal pass covers it');
        // Soft checks: one bad popup is reported, and the rest are still checked.
        for (const { page: p, popups } of WHERE) {
            await page.goto(p);
            const triggers = page.locator(TRIGGER);
            await expect.soft(triggers, `${p}: number of popups`).toHaveCount(popups.length);
            const count = await triggers.count();
            for (let i = 0; i < count; i++) {
                const label = `${p} popup ${i + 1}`;
                const trigger = triggers.nth(i);
                await expect.soft(trigger, `${label}: no script state`).not.toHaveAttribute('data-state');
                const found = await softTipOf(page, trigger, label);
                if (!found) continue;
                await expect.soft(trigger, `${label}: browser popover switch`).toHaveAttribute('popovertarget', found.id);
                expect.soft(await tipWords(found.tip), `${label}: words in the page`).toBe(WORDS.popup);
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
        await pressAt(page, testInfo, 4, (await heroSubline(page).boundingBox()).y + 4);
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

// Acceptance check 25.c (17.c.i): the popup is an extra, never instead of the
// visible line. Every badge keeps its words beside it with no tap: the short
// form, except a badge inside an "Off-grid, explained" section (on Home and on
// each app page), which has the full legend beside it instead. That section's
// heading is plain on every page: no popup word in it (13.a.ii). Every miss on
// every page is collected, then the test fails once.
test('every badge keeps its words beside it: the short form, or the full legend in an "Off-grid, explained" section', async ({ page }, testInfo) => {
    test.skip(isReducedMotion(testInfo), 'words do not change with motion; the normal pass covers them');
    const misses = [];
    for (const p of ['/', ...APPS.map((a) => a.page)]) {
        await page.goto(p);
        await popupsLive(page);
        const legend = p === '/' ? WORDS.legendOnHome : WORDS.legendOnAppPage;
        const found = await page.evaluate(({ trigger, heading }) => {
            const norm = (s) => s.replace(/\s+/g, ' ').trim();
            const isExplained = (section) => {
                const h2 = section?.querySelector(':scope > h2');
                return !!h2 && norm(h2.innerText) === heading;
            };
            // A badge is a popup button outside a heading (the hero and
            // grid words sit inside theirs). What is beside it: its card, or
            // the paragraph it is in.
            const badges = [...document.querySelectorAll(`main ${trigger}`)]
                .filter((el) => !el.closest('h1, h2, h3, h4, h5, h6'))
                .map((el, i) => {
                    const beside = el.closest('article, p');
                    const card = beside?.tagName === 'ARTICLE' ? norm(beside.querySelector('h3')?.innerText ?? '') : null;
                    return {
                        where: card ? `card ${card}` : `badge ${i + 1}`,
                        inExplained: isExplained(el.closest('section')),
                        beside: beside ? norm(beside.innerText) : '',
                    };
                });
            const headings = [...document.querySelectorAll('main section')].filter(isExplained)
                .map((s) => s.querySelector(':scope > h2'))
                .map((h) => ({ text: norm(h.textContent), triggers: h.querySelectorAll(trigger).length }));
            return { badges, headings };
        }, { trigger: TRIGGER, heading: WORDS.explainedHeading });

        // So the check can't pass by finding nothing: Home has the section
        // badge and one per card; each app page has the section badge and
        // the one by its intro.
        const inSection = found.badges.filter((b) => b.inExplained).length;
        const outside = found.badges.length - inSection;
        const wantOutside = p === '/' ? APPS.length : 1;
        if (inSection !== 1) misses.push(`${p}: ${inSection} badges in an "Off-grid, explained" section, want 1`);
        if (outside !== wantOutside) misses.push(`${p}: ${outside} badges outside it, want ${wantOutside}`);
        for (const b of found.badges) {
            if (b.inExplained) {
                if (!b.beside.includes(legend)) misses.push(`${p} ${b.where} (in the section): the full legend is not beside it: "${b.beside.slice(0, 90)}"`);
                if (b.beside.includes(WORDS.shortForm)) misses.push(`${p} ${b.where} (in the section): has the short form instead of only the legend`);
            } else if (!b.beside.includes(WORDS.shortForm)) {
                misses.push(`${p} ${b.where}: the short form is not beside it: "${b.beside.slice(0, 90)}"`);
            }
        }
        if (found.headings.length !== 1) misses.push(`${p}: ${found.headings.length} "Off-grid, explained" headings, want 1`);
        for (const h of found.headings) {
            if (h.triggers) misses.push(`${p}: the "Off-grid, explained" heading holds ${h.triggers} popup words, want none`);
            if (h.text !== WORDS.explainedHeading) misses.push(`${p}: the "Off-grid, explained" heading's full text is "${h.text}"`);
        }
    }
    expect(misses, 'badges without their visible words, and "Off-grid, explained" headings that are not plain (25.c, 13.a.ii)').toEqual([]);
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
