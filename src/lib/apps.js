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

function toPublic(app) {
    const words = appWords[app.id];
    if (!words) {
        throw new Error(`content/app-words.json has no entry for the app "${app.id}".`);
    }
    if (typeof app.slug !== 'string' || !SLUG.test(app.slug)) {
        throw new Error(`content/apps.json: "${app.id}" needs a slug of lower-case words and dashes, like "photo-search".`);
    }
    if (words.whereItLives && !Array.isArray(words.whereItLives.lines)) {
        throw new Error(`content/app-words.json: "${app.id}".whereItLives needs "lines", a list of sentences.`);
    }
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

const publicApps = apps.filter((app) => SHOWN.has(app.status)).map(toPublic);

const slugs = new Set();
for (const app of publicApps) {
    if (slugs.has(app.slug)) {
        throw new Error(`content/apps.json: two apps use the slug "${app.slug}".`);
    }
    slugs.add(app.slug);
}

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
