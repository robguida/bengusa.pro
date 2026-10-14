// The content check (src/lib/apps.js), which runs inside every build: it
// lists EVERY problem in the app list, then fails the build once, with the
// full list (failing the build on a bad app list is the spec's own pattern,
// acceptance check 24.d). One of its rules: an app marked Off-grid must have
// its "What it connects to" line, or its page would quietly lose its
// "Off-grid, explained" section and its badges' popup link (must-have 6).
//
// The real app list is clean, so each case is a TEST-ONLY build: the site is
// copied into test-results/ (support/fixture-site.mjs), the COPY's content is
// broken on purpose, and the copy is built with the same guarded build
// script. src/ and content/ are never touched. About 10 to 20 seconds a case.
//   - two bad apps: TimeTracker with a bad slug, and Vault (Off-grid) with
//     no connects line. The build fails once and its report names both.
//   - an Off-grid app with no connects line, and nothing else wrong: the
//     build fails, and that rule is the reason.
//   - the About words (content/about-words.json), checked by the same build
//     check: Catche's "What we're making" line empty, Vault's line missing,
//     and the co-founder's bio not text. The build fails once and its report
//     names all three.
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { ROOT } from '../../scripts/lib/export-checks.mjs';
import { BUILD_TIMEOUT, buildCopy, copySite, readJson, removeCopy, writeJson } from '../support/fixture-site.mjs';

const CASES = [
    {
        name: 'two-bad-apps',
        title: 'a test-only build with TWO bad apps fails once, and its one report names both',
        change: (apps, words) => {
            apps.find((a) => a.id === 'timetracker').slug = 'Time Tracker';
            delete words.vault.connects;
        },
        // In app-list order: TimeTracker comes before Vault.
        problems: [/^content\/apps\.json: "timetracker" needs a slug\b/, /^content\/app-words\.json: "vault" is marked Off-grid\b.*needs "connects"/],
    },
    {
        name: 'off-grid-no-connects',
        title: 'a test-only build where an Off-grid app has no connects line fails, for that reason',
        change: (apps, words) => {
            delete words.timetracker.connects;
        },
        problems: [/^content\/app-words\.json: "timetracker" is marked Off-grid\b.*needs "connects"/],
    },
    {
        name: 'about-lines',
        title: 'a test-only build where About misses app lines and has a non-text bio fails once, and its one report names each',
        change: (apps, words, about) => {
            about.making.lines.catche = '';
            delete about.making.lines.vault;
            about.people.list[1].bio = 42;
        },
        // The app lines in app-list order, then the rest of the About words.
        problems: [
            /^content\/about-words\.json: "making\.lines" needs a line for the app "catche"\.$/,
            /^content\/about-words\.json: "making\.lines" needs a line for the app "vault"\.$/,
            /^content\/about-words\.json: "people\.list\[1\]\.bio" must be text\.$/,
        ],
    },
];

// Every report the build printed: the count it states, and the problems it
// lists. Next prints the error more than once, indented inside its own
// messages, so a list line is "- <problem>" after any amount of space.
function reports(log) {
    const found = [];
    const re = /The content check found (\d+) problems?:((?:\r?\n[ \t]*- [^\r\n]*)+)/g;
    for (const m of log.matchAll(re)) {
        found.push({
            count: Number(m[1]),
            problems: m[2].split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^[ \t]*- /, '')),
        });
    }
    return found;
}

test.describe('the content check in the build', () => {
    for (const c of CASES) {
        test(c.title, async () => {
            test.setTimeout(BUILD_TIMEOUT);
            const dir = path.join(ROOT, 'test-results', `content-check-${c.name}`);
            try {
                copySite(dir);
                const appsFile = path.join(dir, 'content', 'apps.json');
                const wordsFile = path.join(dir, 'content', 'app-words.json');
                const aboutFile = path.join(dir, 'content', 'about-words.json');
                const apps = readJson(appsFile);
                const words = readJson(wordsFile);
                const about = readJson(aboutFile);
                // The case only means something if the real content is clean
                // where the copy is broken.
                expect(apps.find((a) => a.id === 'timetracker').offGrid, 'real list: TimeTracker is Off-grid').toBe(true);
                expect(apps.find((a) => a.id === 'vault').offGrid, 'real list: Vault is Off-grid').toBe(true);
                expect(words.timetracker.connects && words.vault.connects, 'real words: both have a connects line').toBeTruthy();
                expect(about.making.lines.catche && about.making.lines.vault, 'real About words: Catche and Vault have a line').toBeTruthy();
                expect(typeof about.people.list[1].bio, 'real About words: the co-founder\'s bio is text').toBe('string');
                c.change(apps, words, about);
                writeJson(appsFile, apps);
                writeJson(wordsFile, words);
                writeJson(aboutFile, about);

                const build = await buildCopy(dir);
                const tail = build.log.slice(-3000);
                expect(build.code, `the build must fail. Its log ends:\n${tail}`).not.toBe(0);
                const found = reports(build.log);
                expect(found.length, `the build printed the content check's report. Its log ends:\n${tail}`).toBeGreaterThan(0);
                // However often the build prints it, every report is the
                // same single report: the full count and every problem.
                for (const r of found) {
                    expect.soft(r.count, 'problems the report counts').toBe(c.problems.length);
                    expect.soft(r.problems.length, `problems the report lists: ${JSON.stringify(r.problems)}`).toBe(c.problems.length);
                    c.problems.forEach((want, i) => {
                        expect.soft(r.problems[i] ?? '', `report line ${i + 1}`).toMatch(want);
                    });
                }
            } finally {
                removeCopy(dir);
            }
        });
    }
});
