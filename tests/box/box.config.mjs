// The box run (BUWEB-114, Stanley's ruling 2.a): the browser walk in
// box.spec.mjs against the staged build on the box's bare IP, after checklist
// step 33 and before Rob's go. It is the only test that sees the page's own
// policy (the meta tag the build writes) and the server's policy header (the
// nginx "cap") live together.
//
//   E2E_BASE_URL=http://STATIC-IP/ npx playwright test -c box/box.config.mjs   (from tests/)
//
// E2E_BASE_URL set: it is the baseURL, and NO local server starts. Before any
// test, http://STATIC-IP/version.txt is read and its build= line printed; the
// last line names that build ("BOX TEST PASS for build=..."), so the run is
// tied to the build on Rob's step-32 "staged" line.
// E2E_BASE_URL not set: nothing changes from a normal local run. The walk runs
// against out/ on the gate's local server (port 4310), with no build ID and no
// header check (the local server sends no policy header).
//
// The normal suite (tests/playwright.config.mjs) never runs this file: its
// projects only match tests/checks/ and tests/e2e/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { boxBaseURL } from './box-build.mjs';

process.env.NEXT_TELEMETRY_DISABLED = '1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(TESTS, '..');
const BOX = boxBaseURL(); // '' when E2E_BASE_URL is not set; throws on a malformed one
const PORT = Number(process.env.E2E_PORT || 4310);
const baseURL = BOX || `http://127.0.0.1:${PORT}`;

// Chromium and WebKit, each at 390px (a phone, touch) and 1280px (a computer).
const PHONE_390 = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };
const DESKTOP_1280 = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
    testDir: HERE,
    testMatch: 'box.spec.mjs',
    outputDir: path.join(TESTS, 'test-results', 'box'),
    fullyParallel: true,
    workers: 2,
    forbidOnly: true,
    retries: 0, // a box check that needs a retry to pass is a FAIL
    reporter: [['list'], [path.join(HERE, 'box-reporter.mjs')]],
    globalSetup: path.join(HERE, 'box-setup.mjs'),
    use: { baseURL, trace: 'retain-on-failure' },
    webServer: BOX ? undefined : {
        command: `node scripts/serve-out.mjs --port ${PORT}`,
        cwd: REPO_ROOT,
        url: `${baseURL}/`,
        reuseExistingServer: false,
        timeout: 15_000,
    },
    projects: [
        { name: 'box-chromium-1280', use: { ...devices['Desktop Chrome'], ...DESKTOP_1280 } },
        { name: 'box-chromium-390', use: { ...devices['Pixel 7'], ...PHONE_390 } },
        { name: 'box-webkit-1280', use: { ...devices['Desktop Safari'], ...DESKTOP_1280 } },
        { name: 'box-webkit-390', use: { ...devices['iPhone 14'] } },
    ],
});
