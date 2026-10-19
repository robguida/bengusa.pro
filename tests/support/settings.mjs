// What the live build shows, read from content/site-settings.json (the one
// committed switch: BUWEB-114). Release 1 hides the apps and Contact: their
// pages sit in src/app/_parked/ and are NOT built into out/.
//
// Tests that only mean something while the apps are shown are PARKED, never
// deleted: they skip with APPS_PARKED. They switch themselves back on when the
// setting turns showApps on (the apps-return ticket re-enables them and fixes
// whatever has drifted; Quinn's ruling 2 on BUWEB-114: no "apps shown" build).
//
// The file is read by readSiteSettings(), the same reader the build checks and
// the packager use (one rule, src/lib/site-settings.mjs), so the tests can't
// drift from the build. Only true shows a page. A missing or broken file, a
// missing switch or a value that isn't true/false is a PROBLEM, and everything
// it touches counts as hidden: release1.spec.mjs fails on any problem.
import { test } from '@playwright/test';
import { readSiteSettings } from '../../scripts/lib/export-checks.mjs';
import { SITE_SETTINGS_FILE } from '../../src/lib/site-settings.mjs';

const settings = readSiteSettings();

export const SETTINGS_FILE = SITE_SETTINGS_FILE;
export const SETTINGS_PROBLEMS = settings.problems;
export const SHOW = { apps: settings.showApps, contact: settings.showContact };

export const APPS_PARKED = 'apps hidden by site-settings; re-enable when the tiles return';
export const CONTACT_PARKED = 'Contact hidden by site-settings; re-enable when Contact returns';

// For a PART of a live test that waits for the apps (an `if (SHOW.apps)`
// branch): it adds a "parked" note to the test's report, so what is not
// checked today shows up there, not only in tests/README.md. Once per part.
export function noteParked(part) {
    const { annotations } = test.info();
    const description = `${part}: ${APPS_PARKED}`;
    if (!annotations.some((a) => a.type === 'parked' && a.description === description)) {
        annotations.push({ type: 'parked', description });
    }
}
