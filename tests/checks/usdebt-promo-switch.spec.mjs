// The "Our U.S. Debt" block on Home has an off switch (BUWEB-128):
// "showUsDebtPromo" in content/site-settings.json. If the usdebt launch slips,
// turning it to false must take the block, its words and its outside link out
// of the built site.
//
// The real build has the switch ON, so the OFF case is a TEST-ONLY build: the
// site is copied into src/.fixture-sites/ (support/fixture-site.mjs), the COPY's
// switch is set to false, and the copy is built with the same guarded build
// script. The copy's out/index.html is read as text (no browser needed).
// app/, lib/ and content/ are never touched. The copy is deleted afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { BUILD_TIMEOUT, FIXTURE_SITES, buildCopy, copySite, readJson, removeCopy, siteOf, writeJson } from '../support/fixture-site.mjs';
import { USDEBT } from '../support/words.mjs';

const DIR = path.join(FIXTURE_SITES, 'usdebt-promo-off');

test.describe('the "Our U.S. Debt" switch, test-only build with showUsDebtPromo set to false', () => {
    test.setTimeout(BUILD_TIMEOUT);
    test.afterAll(() => { removeCopy(DIR); });

    test('the block, its words and its link are not in the built Home page', async () => {
        copySite(DIR);
        const file = path.join(siteOf(DIR), 'content', 'site-settings.json');
        const settings = readJson(file);
        expect(settings.showUsDebtPromo, 'the real switch is on: this fixture changes it in the copy only').toBe(true);
        writeJson(file, { ...settings, showUsDebtPromo: false });

        const build = await buildCopy(DIR);
        expect(build.code, `the switched-off build failed:\n${build.log.slice(-3000)}`).toBe(0);

        const out = path.join(siteOf(DIR), 'out');
        const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
        const plain = home.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
        // The "Apps coming soon!" heading stays; only the block is gone.
        expect.soft(plain, 'the section heading stays').toContain('Apps coming soon!');
        for (const gone of [USDEBT.leadIn, USDEBT.title, 'national debt day by day', 'bengusa.pro/ourusdebt']) {
            expect.soft(plain, `Home text holds "${gone}"`).not.toContain(gone);
        }
        expect.soft(home, 'the outside address anywhere in Home').not.toContain(USDEBT.url);
        const main = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
        expect.soft(main, "a link in Home's main area").not.toMatch(/<a\b/);
    });
});
