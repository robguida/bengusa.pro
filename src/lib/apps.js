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
    return {
        id: app.id,
        status: app.status,
        name: app.name,
        shortName: app.shortName,
        offGrid: app.offGrid === true,
        slug: app.slug,
        href: `/apps/${app.slug}/`,
        tagline: words.tagline,
        summary: words.summary,
        cardNote: words.cardNote ?? null,
        intro: words.intro,
        connects: words.connects ?? null,
        cloud: words.cloud ?? null,
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
