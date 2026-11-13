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
import { LANGBASICS, USDEBT } from '../support/words.mjs';

const DIR = path.join(FIXTURE_SITES, 'usdebt-promo-off');

test.describe('the "Our U.S. Debt" switch, test-only build with showUsDebtPromo set to false', () => {
    test.setTimeout(BUILD_TIMEOUT);
    test.afterAll(() => { removeCopy(DIR); });

    test('the block, its words and its link are not in the built Home page; Language Basics and the shared lead-in stay', async () => {
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
        for (const gone of [USDEBT.title, 'national debt day by day', 'bengusa.pro/ourusdebt']) {
            expect.soft(plain, `Home text holds "${gone}"`).not.toContain(gone);
        }
        expect.soft(home, 'the outside address anywhere in Home').not.toContain(USDEBT.url);
        // BUWEB-135: with only Language Basics on, the shared lead-in sits above it.
        expect.soft(plain, 'the lead-in stays above the one block left').toContain(USDEBT.leadIn);
        expect.soft(plain, 'Language Basics stays').toContain(LANGBASICS.title);
        const main = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
        expect.soft(main.match(/<a\b/g) || [], "links in Home's main area: only the Language Basics button").toHaveLength(1);
    });
});

// BUWEB-135: the Language Basics switch, and the shared lead-in (shown while either block is on, never when both are off).
for (const { name, set, wantLeadIn, wantUsDebt, wantLang } of [
    { name: 'Language Basics off, Our U.S. Debt on', set: { showLanguageBasicsPromo: false }, wantLeadIn: true, wantUsDebt: true, wantLang: false },
    { name: 'both blocks off', set: { showUsDebtPromo: false, showLanguageBasicsPromo: false }, wantLeadIn: false, wantUsDebt: false, wantLang: false },
]) {
    test.describe(`the "Language Basics" switch, test-only build: ${name}`, () => {
        const dir = path.join(FIXTURE_SITES, `language-basics-${name.replace(/[^a-z]+/gi, '-').toLowerCase()}`);
        test.setTimeout(BUILD_TIMEOUT);
        test.afterAll(() => { removeCopy(dir); });

        test('what is built matches the switches', async () => {
            copySite(dir);
            const file = path.join(siteOf(dir), 'content', 'site-settings.json');
            const settings = readJson(file);
            expect(settings.showLanguageBasicsPromo, 'the real switch is on: this fixture changes it in the copy only').toBe(true);
            writeJson(file, { ...settings, ...set });

            const build = await buildCopy(dir);
            expect(build.code, `the build failed:\n${build.log.slice(-3000)}`).toBe(0);

            const home = fs.readFileSync(path.join(siteOf(dir), 'out', 'index.html'), 'utf8');
            // Visible text only: the page data inside <script> tags repeats the words.
            const plain = home.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
            expect.soft(plain, 'the section heading stays').toContain('Apps coming soon!');
            expect.soft(plain.includes(USDEBT.leadIn), 'the shared lead-in').toBe(wantLeadIn);
            expect.soft(plain.split(USDEBT.leadIn).length - 1, 'the lead-in shows at most once').toBeLessThanOrEqual(1);
            expect.soft(plain.includes(USDEBT.title), 'Our U.S. Debt block').toBe(wantUsDebt);
            expect.soft(plain.includes(LANGBASICS.title), 'Language Basics block').toBe(wantLang);
            expect.soft(home.includes(LANGBASICS.url), 'the Language Basics address').toBe(wantLang);
            expect.soft(plain, 'the Language Basics words').not.toContain('Flashcards for your first words');
        });
    });
}
