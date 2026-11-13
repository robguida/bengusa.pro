// The one rule for the site switch, content/site-settings.json (BUWEB-114).
// Every reader uses it, so they can't drift apart:
//   - src/lib/site.js, for the pages (through Next);
//   - readSiteSettings() in scripts/lib/export-checks.mjs, for the build
//     checks, the packager and the tests (plain Node).
// It imports nothing, so it loads in both. site.js can't be the shared reader
// itself: its 'server-only' import throws outside Next.
//
// Each switch must be true or false. A missing switch, or any other value, is
// a problem, and a problem fails the build. Only true shows a page: anything
// else counts as hidden, so a broken switch can never put a hidden page on the
// site (fail closed).

export const SITE_SETTINGS_FILE = 'content/site-settings.json';
export const SITE_SWITCH_KEYS = ['showApps', 'showContact', 'showUsDebtPromo'];

// showUsDebtPromo (BUWEB-128) turns the "Our U.S. Debt" block on Home on or off.
//
// raw: the parsed file. Returns { showApps, showContact, showUsDebtPromo, problems }, with every
// problem listed.
export function checkSiteSettings(raw) {
    const problems = [];
    const isObject = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
    if (!isObject) problems.push(`${SITE_SETTINGS_FILE} must hold one JSON object, like {"showApps": false}`);
    const settings = {};
    for (const key of SITE_SWITCH_KEYS) {
        const has = isObject && Object.hasOwn(raw, key);
        const value = has ? raw[key] : undefined;
        if (isObject && !has) problems.push(`${SITE_SETTINGS_FILE}: "${key}" is missing (it must be true or false)`);
        else if (has && typeof value !== 'boolean') problems.push(`${SITE_SETTINGS_FILE}: "${key}" must be true or false`);
        settings[key] = value === true;
    }
    return { ...settings, problems };
}
