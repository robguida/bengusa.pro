// Helpers for the Off-grid popup (spec 17.c). The page's hooks:
//   [data-offgrid="trigger"]  the button (a badge, or the word in the hero / heading)
//   [data-offgrid="tip"]      its box (a popover), found through aria-controls
//   data-state="open|closed"  on both, once the page's script has taken over.
// data-state is absent before that, and with scripts off.
import { expect, isPhone, settle } from './site.mjs';

export const TRIGGER = '[data-offgrid="trigger"]';
export const TIP = '[data-offgrid="tip"]';

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

export const isShowing = (tip) => tip.evaluate((el) => el.matches(':popover-open'));

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
