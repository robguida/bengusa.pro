// Playwright runs against the PRODUCTION static build (out/), served by
// scripts/serve-out.mjs. Never the dev server. Build first: `npm run build`
// (or run everything with `npm test`). See tests/README.md.
import { defineConfig, devices } from '@playwright/test';

process.env.NEXT_TELEMETRY_DISABLED = '1';

const PORT = Number(process.env.E2E_PORT || 4310);
const baseURL = `http://127.0.0.1:${PORT}`;

// Both phones use a 390px-wide screen: the width the "no sideways scroll"
// rule names, and the width the phone header sizes are set for.
const PHONE_390 = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };

const browsers = [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], ...PHONE_390 } },
];

export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    fullyParallel: true,
    // Capped locally: more parallel WebKit windows than this starved each
    // other on the laptop and timed out. CI uses Playwright's default.
    workers: process.env.CI ? undefined : 4,
    forbidOnly: !!process.env.CI,
    retries: 0, // a test that needs a retry to pass is a defect, not noise
    reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
    use: { baseURL, trace: 'retain-on-failure' },
    webServer: {
        command: `node scripts/serve-out.mjs --port ${PORT}`,
        url: `${baseURL}/`,
        reuseExistingServer: false,
        timeout: 15_000,
    },
    projects: [
        // No browser: checks on the build output, plain HTTP checks, the mail fake.
        { name: 'checks', testMatch: 'checks/**/*.spec.mjs' },
        // Browsers, normal motion.
        ...browsers.map((b) => ({ ...b, testMatch: 'e2e/**/*.spec.mjs' })),
        // Second pass: the same browser tests with reduce-motion switched on.
        ...browsers.map((b) => ({
            name: `${b.name}-reduced-motion`,
            testMatch: 'e2e/**/*.spec.mjs',
            use: { ...b.use, reducedMotion: 'reduce' },
        })),
    ],
});
