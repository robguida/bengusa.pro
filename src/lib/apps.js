import 'server-only';
import apps from '../../content/apps.json';
import appWords from '../../content/app-words.json';

// The one app list. Cards, app pages, the header and phone menus and the footer
// are all built from content/apps.json, in its order. Its words (card lines,
// page text) live in content/app-words.json, keyed by the same ID.
//
// Only what a page shows leaves this file: open and showcase apps, with their
// ID, status and display fields. Retired apps and the list-only fields
// (sold, freeBeta, templatesCheckedAt) never reach a page or the browser.

const SHOWN = new Set(['open', 'showcase']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The content check. It looks at every shown app and lists every problem it
// finds, so one build shows them all; then the build fails once, with the
// full list. Failing the build on a bad app list is the spec's own pattern
// (acceptance check 24.d).
function problemsWith(app) {
    const problems = [];
    const words = appWords[app.id];
    if (!words) {
        problems.push(`content/app-words.json has no entry for the app "${app.id}".`);
    }
    if (typeof app.slug !== 'string' || !SLUG.test(app.slug)) {
        problems.push(`content/apps.json: "${app.id}" needs a slug of lower-case words and dashes, like "photo-search".`);
    }
    if (!words) return problems;
    if (words.whereItLives && !Array.isArray(words.whereItLives.lines)) {
        problems.push(`content/app-words.json: "${app.id}".whereItLives needs "lines", a list of sentences.`);
    }
    const { connects } = words;
    if (connects != null && (typeof connects.label !== 'string' || typeof connects.text !== 'string')) {
        problems.push(`content/app-words.json: "${app.id}".connects needs a "label" and a "text".`);
    }
    // An Off-grid app's page must have its "What <App> connects to" box:
    // without it, the page would quietly drop its "Off-grid, explained"
    // section and its badges' popup link.
    if (app.offGrid === true && connects == null) {
        problems.push(`content/app-words.json: "${app.id}" is marked Off-grid in content/apps.json, so it needs "connects", its "What it connects to" line.`);
    }
    return problems;
}

function toPublic(app) {
    const words = appWords[app.id];
    const offGrid = app.offGrid === true;
    const href = `/apps/${app.slug}/`;
    const connects = words.connects ?? null;
    // The app page shows its "What <App> connects to" box only when the app is
    // Off-grid and has a connects line. Only then do its badge popups link to
    // it, labelled like the box without the colon (spec 17.c.iv).
    const connectsId = offGrid && connects ? `${app.id}-connects` : null;
    return {
        id: app.id,
        status: app.status,
        name: app.name,
        shortName: app.shortName,
        offGrid,
        slug: app.slug,
        href,
        tagline: words.tagline,
        summary: words.summary,
        cardNote: words.cardNote ?? null,
        intro: words.intro,
        connects,
        connectsId,
        connectsLink: connectsId
            ? { href: `${href}#${connectsId}`, label: connects.label.replace(/:\s*$/, '') }
            : null,
        whereItLives: words.whereItLives ?? null,
    };
}

const shownApps = apps.filter((app) => SHOWN.has(app.status));

const problems = shownApps.flatMap(problemsWith);
const slugs = new Set();
for (const app of shownApps) {
    if (typeof app.slug !== 'string') continue; // already listed above
    if (slugs.has(app.slug)) problems.push(`content/apps.json: two apps use the slug "${app.slug}".`);
    slugs.add(app.slug);
}
if (problems.length > 0) {
    throw new Error(`The content check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`
        + problems.map((p) => `  - ${p}`).join('\n'));
}

const publicApps = shownApps.map(toPublic);

export function getPublicApps() {
    return publicApps;
}

export function getPublicApp(slug) {
    return publicApps.find((app) => app.slug === slug) ?? null;
}

// The smallest shape the menus need. This is all the header (a client
// component) receives.
export function toMenuItems(list) {
    return list.map(({ id, name, href }) => ({ id, name, href }));
}
