// The heading guard (spec 17.b.i, acceptance check 25.b): "Meet our Off-grid
// apps" is true only while every card in the grid wears the badge, open and
// showcase cards alike. With any card unbadged, the build must print "Meet our
// apps" instead.
//
// The real app list has every card badged, so this needs a TEST-ONLY build:
// the site is copied into test-results/ (never touching src/ or content/),
// one card loses its badge in the COPY's app list, and the copy is built with
// the same guarded build script, served on its own port and opened in a
// browser. One fixture per case:
//   - open:     Vault, an open card, with no badge;
//   - showcase: TimeTracker switched to a showcase card, with no badge.
// The copy is deleted afterwards. The real build's heading is checked in
// e2e/home.spec.mjs.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT } from '../../scripts/lib/export-checks.mjs';
import { test as siteTest, expect, settle } from '../support/site.mjs';
import { TRIGGER } from '../support/offgrid.mjs';
import { BUILD_TIMEOUT, buildCopy, copySite, readJson, removeCopy, writeJson } from '../support/fixture-site.mjs';
import { APPS, WORDS } from '../support/words.mjs';

const FIRST_PORT = Number(process.env.E2E_PORT || 4310) + 10;
const SERVE_TIMEOUT = 15_000;

const FIXTURES = {
    open: {
        label: 'an open card (Vault) without the badge',
        app: 'vault',
        change: (app) => { app.offGrid = false; },
    },
    showcase: {
        label: 'a showcase card (TimeTracker) without the badge',
        app: 'timetracker',
        change: (app) => { app.status = 'showcase'; app.offGrid = false; },
    },
};

const SHOWN = new Set(['open', 'showcase']);
const unbadged = (apps) => apps.filter((a) => SHOWN.has(a.status) && a.offGrid !== true).map((a) => a.id);

async function buildFixture(name, dir) {
    const fixture = FIXTURES[name];
    copySite(dir);
    const file = path.join(dir, 'content', 'apps.json');
    const apps = readJson(file);
    // The fixture only means something if the real list is all badged and
    // the copy differs from it by exactly one unbadged card.
    expect(unbadged(apps), 'the real app list already has an unbadged card: this fixture tests nothing new').toEqual([]);
    fixture.change(apps.find((a) => a.id === fixture.app));
    expect(unbadged(apps), `${name} fixture: unbadged cards`).toEqual([fixture.app]);
    writeJson(file, apps);
    const build = await buildCopy(dir);
    if (build.code !== 0) throw new Error(`the ${name} fixture build failed (exit ${build.code}):\n${build.log.slice(-4000)}`);
}

// Serves dir/out on its own port; resolves once it answers. Ends early on
// state (the first 200), never on a fixed wait.
async function serve(outDir, port) {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve-out.mjs'), '--port', String(port), '--dir', outDir], { stdio: 'ignore' });
    const url = `http://127.0.0.1:${port}`;
    const until = Date.now() + SERVE_TIMEOUT;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`the fixture server on port ${port} stopped (exit ${child.exitCode})`);
        try {
            if ((await fetch(`${url}/`)).status === 200) return { child, url };
        } catch {
            // not listening yet
        }
        if (Date.now() > until) {
            child.kill();
            throw new Error(`the fixture server on port ${port} did not answer within ${SERVE_TIMEOUT}ms`);
        }
        await new Promise((r) => { setTimeout(r, 50); });
    }
}

const test = siteTest.extend({
    fixture: ['open', { option: true }],
    // One copy per worker, built only for the fixtures that worker runs.
    guardSites: [async ({}, provide, workerInfo) => {
        const base = path.join(ROOT, 'test-results', `heading-guard-${workerInfo.parallelIndex}`);
        const started = new Map();
        const site = async (name) => {
            if (!started.has(name)) {
                const dir = path.join(base, name);
                await buildFixture(name, dir);
                const port = FIRST_PORT + workerInfo.parallelIndex * Object.keys(FIXTURES).length + Object.keys(FIXTURES).indexOf(name);
                started.set(name, await serve(path.join(dir, 'out'), port));
            }
            return started.get(name);
        };
        try {
            await provide(site);
        } finally {
            for (const { child } of started.values()) child.kill();
            removeCopy(base);
        }
    }, { scope: 'worker' }],
    // The browser and the site guard (no outside requests) both use the
    // fixture's own address.
    baseURL: [async ({ guardSites, fixture }, provide) => {
        await provide((await guardSites(fixture)).url);
    }, { timeout: BUILD_TIMEOUT }],
});

for (const [name, fixture] of Object.entries(FIXTURES)) {
    test.describe(`heading guard, test-only build with ${fixture.label}`, () => {
        test.use({ fixture: name });

        test('the heading falls back to "Meet our apps"; that card has no badge and no popup link points at its box', async ({ page }) => {
            await page.goto('/');
            await settle(page);
            const h2 = page.locator('h2#apps-title');
            expect(await h2.evaluate((el) => el.innerText.replace(/\s+/g, ' ').trim()), 'grid heading').toBe(WORDS.appsHeadingFallback);
            await expect(h2.locator(TRIGGER), 'no popup word in the fallback heading').toHaveCount(0);

            const off = APPS.find((a) => a.id === fixture.app);
            for (const app of APPS) {
                const card = page.locator('#apps article').filter({ has: page.locator('h3', { hasText: app.shortName }) });
                await expect(card, `${app.shortName}: card shown`).toHaveCount(1);
                await expect(card.locator(TRIGGER), `${app.shortName}: badge`).toHaveCount(app === off ? 0 : 1);
            }
            await expect(page.locator(`a[href$="#${off.box}"]`), `no popup link to ${off.shortName}'s box`).toHaveCount(0);
        });
    });
}
