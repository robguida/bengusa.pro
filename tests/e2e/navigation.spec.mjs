// Footer, menus and network behaviour on every page.
import { test, expect, PAGES, isPhone, menuButton, networkQuiet, scrollToY, settle } from '../support/site.mjs';
import { describeBug, misnamedPageDataFiles, pathOf } from '../support/windows-export-bug.mjs';

const APP_PAGES = PAGES.filter((p) => p.startsWith('/apps/'));

test('footer with the Privacy link and "© 2026 bengUSA.pro" on every page', async ({ page }) => {
    for (const p of PAGES) {
        await page.goto(p);
        const footer = page.locator('footer');
        const privacy = footer.getByRole('link', { name: 'Privacy', exact: true });
        await expect.soft(privacy, `${p}: Privacy link`).toBeVisible();
        await expect.soft(privacy, `${p}: Privacy link target`).toHaveAttribute('href', '/privacy/');
        await expect.soft(footer, `${p}: copyright line`).toContainText('© 2026 bengUSA.pro');
    }
});

for (const p of ['/', '/about/']) {
    test(`menu on ${p}: opens, then Escape closes it and puts focus back on its button`, async ({ page }, testInfo) => {
        await page.goto(p);
        await settle(page);
        // The phone button's name changes when open, so find it again by the panel it controls.
        const panelId = await menuButton(page, testInfo).getAttribute('aria-controls');
        const button = page.locator(`button[aria-controls="${panelId}"]`);
        const panel = page.locator(`[id="${panelId}"]`);

        await button.click();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await expect(panel).toBeVisible();
        const links = panel.getByRole('link');
        // Computer: the Apps menu lists the apps. Phone: the apps, then About and Contact.
        await expect(links).toHaveCount(APP_PAGES.length + (isPhone(testInfo) ? 2 : 0));

        // Move focus INTO the menu first. If focus stayed on the button, a
        // broken "focus goes back" would still pass.
        await links.first().focus();
        await expect(links.first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(panel).toBeHidden();
        await expect(button).toBeFocused();
    });
}

test('no request leaves the local server on any page', async ({ page, siteGuards }) => {
    test.setTimeout(90_000);
    for (const p of PAGES) {
        await page.goto(p, { waitUntil: 'load' });
        await scrollToY(page, 100000);
        await networkQuiet(page);
    }
    // The site guard blocks and records every outside request in every browser test.
    expect(siteGuards.outside).toEqual([]);
});

// Visits every page the way a person would: load it, scroll to the bottom (so
// the links come into view and prefetch), then move between pages by clicking
// footer links (in-app navigation). Returns every response of 400 or more.
async function browse(page) {
    const bad = [];
    page.on('response', (res) => {
        if (res.status() >= 400) bad.push(`${res.status()} ${pathOf(res.url())}`);
    });
    for (const p of PAGES) {
        await page.goto(p, { waitUntil: 'load' });
        await scrollToY(page, 100000);
        await networkQuiet(page);
    }
    await page.goto('/', { waitUntil: 'load' });
    for (const target of [...PAGES.slice(1), '/']) {
        const link = page.locator(`footer a[href="${target}"]`).first();
        if (await link.count()) {
            await link.click();
        } else {
            // The home link wraps the logo; its own box is empty, so click the logo.
            await page.locator('header a[href="/"] [data-logo="mark"]').click();
        }
        await expect(page).toHaveURL((url) => url.pathname === target);
        await networkQuiet(page);
    }
    return [...new Set(bad)].sort();
}

test('no 404s (or any 4xx/5xx) while browsing', async ({ page }) => {
    test.setTimeout(90_000);
    const misnamed = misnamedPageDataFiles();
    // Expected to fail ONLY on Windows while this build carries the known
    // export bug. On Linux (CI, WSL) it must pass, and E2E_STRICT_404=1 makes
    // it strict on Windows too (for a deploy gate). If it passes on a buggy
    // build, Playwright reports that, so the marker can't go stale silently.
    const tolerated = misnamed.length > 0 && process.platform === 'win32' && process.env.E2E_STRICT_404 !== '1';
    test.fail(tolerated, describeBug(misnamed));
    expect(await browse(page)).toEqual([]);
});

test('on a Windows build, every 404 while browsing is the known export bug, nothing else', async ({ page }, testInfo) => {
    const misnamed = misnamedPageDataFiles();
    test.skip(misnamed.length === 0, 'this build does not have the Windows export bug');
    test.skip(testInfo.project.use.reducedMotion === 'reduce', 'motion does not change requests; the normal pass covers it');
    test.setTimeout(90_000);
    const known = new Set(misnamed.map((m) => `404 ${m.url}`));
    const other = (await browse(page)).filter((b) => !known.has(b));
    expect(other).toEqual([]);
});
