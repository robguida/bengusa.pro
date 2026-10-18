// What the live build shows, read from content/site-settings.json (the one
// committed switch: BUWEB-114). Release 1 hides the apps and Contact: their
// pages sit in src/app/_parked/ and are NOT built into out/.
//
// Tests that only mean something while the apps are shown are PARKED, never
// deleted: they skip with APPS_PARKED. They switch themselves back on when the
// setting turns showApps on (the apps-return ticket re-enables them and fixes
// whatever has drifted; Quinn's ruling 2 on BUWEB-114: no "apps shown" build).
//
// If the file is missing, everything counts as shown (the build before
// BUWEB-114), so the test that checks the file itself is the one that fails.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/lib/export-checks.mjs';

export const SETTINGS_FILE = path.join(ROOT, 'content', 'site-settings.json');
export const SETTINGS_PRESENT = fs.existsSync(SETTINGS_FILE);
export const SETTINGS = SETTINGS_PRESENT
    ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    : { showApps: true, showContact: true };

export const SHOW = { apps: SETTINGS.showApps === true, contact: SETTINGS.showContact === true };

export const APPS_PARKED = 'apps hidden by site-settings; re-enable when the tiles return';
export const CONTACT_PARKED = 'Contact hidden by site-settings; re-enable when Contact returns';
