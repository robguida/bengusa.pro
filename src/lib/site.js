import 'server-only';
import settings from '../../content/site-settings.json';
import { checkSiteSettings } from './site-settings.mjs';

// What the live site shows: one committed switch, content/site-settings.json
// (BUWEB-114). Release 1 hides the apps and Contact, and keeps their code:
//   - the app pages and the Contact page sit in src/app/_parked/, which Next
//     leaves out of routing, so they are not built at all;
//   - every list a page or menu is built from leaves them out HERE, at the
//     source. Nothing is hidden with CSS, so a hidden page's name or link never
//     reaches out/ (scripts/build.mjs checks every file in it).
// To show one again: set its switch to true AND move its folder back out of
// src/app/_parked/. The build fails if the switch and the folders disagree.
// What the file means (each switch true or false, nothing missing) is one rule
// in src/lib/site-settings.mjs, shared with the build checks and the tests.

// One build lists every bad switch, then fails once.
const { showApps, showContact, problems } = checkSiteSettings(settings);
if (problems.length > 0) {
    throw new Error(`The site settings check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`
        + problems.map((p) => `  - ${p}`).join('\n'));
}

export const SHOW_APPS = showApps;
export const SHOW_CONTACT = showContact;

// The plain links in the header, on a computer and on a phone, in order.
export function headerLinks() {
    const links = [{ key: 'about', href: '/about/', label: 'About' }];
    if (SHOW_CONTACT) links.push({ key: 'contact', href: '/contact/', label: 'Contact' });
    return links;
}

// The footer: the app links (none while the apps are hidden), the header's
// links, then Privacy.
export function footerLinks(apps) {
    return [
        ...apps.map((app) => ({ key: app.id, href: app.href, label: app.name })),
        ...headerLinks(),
        { key: 'privacy', href: '/privacy/', label: 'Privacy' },
    ];
}
