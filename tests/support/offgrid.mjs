// Helpers for the Off-grid popup (spec 17.c). The page's hooks:
//   [data-offgrid="trigger"]  the button (a badge, or the word in the hero / heading)
//   [data-offgrid="tip"]      its box (a popover), found through aria-controls
//   data-state="open|closed"  on both, once the page's script has taken over.
// data-state is absent before that, and with scripts off.
import { expect, isPhone, settle } from './site.mjs';
import { WORDS } from './words.mjs';

export const TRIGGER = '[data-offgrid="trigger"]';
export const TIP = '[data-offgrid="tip"]';

// The "Off-grid, explained" section (13.a.ii), found by its heading's words.
// On Home it sits between the hero and the app grid (17.a.v); on each
// Off-grid app's page it holds the legend and the connects box. The heading
// is matched by its text, not its accessible name: a popup word wrongly put
// inside it would change the name and hide the section from the very checks
// that look for that mistake.
const exactly = (s) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
export const offGridSection = (page) => page.locator('main section').filter({
    has: page.locator('h2').filter({ hasText: exactly(WORDS.explainedHeading) }),
});

// Waits until React has started the page AND every popup on it is run by the
// script (data-state set). Before that, a click goes to the browser's own
// popover switch instead, so an interaction test would test the wrong thing.
export async function popupsLive(page) {
    await settle(page);
    await expect(page.locator(`${TRIGGER}:not([data-state])`), 'popups still waiting for the script').toHaveCount(0);
}

export async function tipOf(page, trigger) {
    const id = await trigger.getAttribute('aria-controls');
    expect(id, 'trigger has aria-controls').toBeTruthy();
    return page.locator(`[id="${id}"]`);
}

// For loops over many popups: a missing box is a soft failure for THIS popup
// (returns null, so the loop goes on to the next one), never a hard stop.
export async function softTipOf(page, trigger, label) {
    const id = await trigger.getAttribute('aria-controls');
    expect.soft(id, `${label}: trigger has aria-controls`).toBeTruthy();
    if (!id) return null;
    const tip = page.locator(`[id="${id}"]`);
    const found = await tip.count();
    expect.soft(found, `${label}: its box (#${id}) is in the page`).toBe(1);
    return found === 1 ? { tip, id } : null;
}

export const isShowing = (tip) => tip.evaluate((el) => el.matches(':popover-open'));

// The page's own timers (spec 17.c.v): the box opens 150 ms after the mouse
// arrives, and closes 300 ms after it leaves both the trigger and the box.
export const OPEN_DELAY_MS = 150;
export const CLOSE_GRACE_MS = 300;

// Fake clock (page.clock, installed before the page loads). freeze() stops
// the page's time, so its timers fire only when the test moves time on with
// page.clock.runFor(). Waits that need animation frames (settle, centre)
// must run before freeze() or after page.clock.resume().
export async function freeze(page) {
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 50);
}

// "Still open" right after the clock moved on. :popover-open first: the
// page's close path hides the popover at once, inside the timer, while
// data-state follows a render later, so a box that was just closed could
// still read data-state="open" for a moment.
export async function expectStillOpen(trigger, tip, label) {
    expect(await isShowing(tip), `${label}: box still an open popover`).toBe(true);
    await expectOpen(trigger, tip, label);
}

export async function middle(locator) {
    const b = await locator.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function expectOpen(trigger, tip, label) {
    await expect(trigger, `${label}: trigger data-state`).toHaveAttribute('data-state', 'open');
    await expect(trigger, `${label}: aria-expanded`).toHaveAttribute('aria-expanded', 'true');
    await expect(tip, `${label}: box shown`).toBeVisible();
    expect(await isShowing(tip), `${label}: box is an open popover (top layer)`).toBe(true);
}

export async function expectClosed(trigger, tip, label) {
    await expect(trigger, `${label}: trigger data-state`).toHaveAttribute('data-state', 'closed');
    await expect(trigger, `${label}: aria-expanded`).toHaveAttribute('aria-expanded', 'false');
    await expect(tip, `${label}: box hidden`).toBeHidden();
}

// A tap on a phone, a mouse click on a computer.
export async function press(locator, testInfo) {
    if (isPhone(testInfo)) await locator.tap();
    else await locator.click();
}

export async function pressAt(page, testInfo, x, y) {
    if (isPhone(testInfo)) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
}

// Puts the element mid-screen (clear of the fixed header) and waits until the
// page has stopped moving, so a click or a layout snapshot is not mid-scroll.
// The mouse is parked on the header bar first: left where it was, the scroll
// could slide another popup word under it and open that one by hover.
export async function centre(page, locator) {
    await page.mouse.move(2, 2);
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await settle(page);
}

// The box's words without its link: the bold "Off-grid:" and the sentence.
export function tipWords(tip) {
    return tip.evaluate((el) => {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('a').forEach((a) => a.remove());
        return copy.textContent.replace(/\s+/g, ' ').trim();
    });
}
