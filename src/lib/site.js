import 'server-only';
import settings from '../content/site-settings.json';
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
const { showApps, showContact, showUsDebtPromo, problems } = checkSiteSettings(settings);
if (problems.length > 0) {
    throw new Error(`The site settings check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`
        + problems.map((p) => `  - ${p}`).join('\n'));
}

export const SHOW_APPS = showApps;
export const SHOW_CONTACT = showContact;
// The "Our U.S. Debt" block under "Apps coming soon!" on Home (BUWEB-128).
export const SHOW_US_DEBT_PROMO = showUsDebtPromo;
// One-page site (2026-11-02): the About page is parked in src/app/_parked/
// (About's words stand on Home). The Privacy page came back on 2026-11-06
// (BUWEB-125), so it is built and its footer link shows. Links stay in the
// lists below behind these two constants. To bring a parked page back: set its
// constant to true AND move its folder out of src/app/_parked/ (the build's
// route table fails if the two disagree).
export const SHOW_ABOUT = false;
export const SHOW_PRIVACY = true;

// The plain links in the header, on a computer and on a phone, in order.
export function headerLinks() {
    const links = [];
    if (SHOW_ABOUT) links.push({ key: 'about', href: '/about/', label: 'About' });
    if (SHOW_CONTACT) links.push({ key: 'contact', href: '/contact/', label: 'Contact' });
    return links;
}

// The footer: the app links (none while the apps are hidden), the header's
// links, then Privacy.
export function footerLinks(apps) {
    return [
        ...apps.map((app) => ({ key: app.id, href: app.href, label: app.name })),
        ...headerLinks(),
        ...(SHOW_PRIVACY ? [{ key: 'privacy', href: '/privacy/', label: 'Privacy' }] : []),
    ];
}
