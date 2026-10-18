// The approved words and colours, copied from the v1 spec (docs/requirements.md).
// Tests compare the pages against THESE, never against content/*.json, so a
// content edit that drifts from the spec turns a test red. When the spec's
// words change, change them here in the same commit.
import path from 'node:path';
import { ROOT, readJson } from '../../scripts/lib/export-checks.mjs';
import { SHOW } from './settings.mjs';

// The three apps the spec names (acceptance check 3). The IDs are the fixed
// tag IDs (13.e.i, LR-29); each app page's connects box has the id
// "<id>-connects". The page address (slug) is content, so it is read from the
// app list.
const slugs = Object.fromEntries(readJson(path.join(ROOT, 'content', 'apps.json')).map((a) => [a.id, a.slug]));
export const APPS = [
    { id: 'catche', shortName: 'Catche', name: 'Catche (working name)' },
    { id: 'timetracker', shortName: 'TimeTracker', name: 'TimeTracker' },
    { id: 'vault', shortName: 'Vault', name: 'Vault (working name)' },
].map((app) => ({ ...app, page: `/apps/${slugs[app.id]}/`, box: `${app.id}-connects` }));

export const WORDS = {
    hero: 'Makers of Off-grid apps.', // 17.a.i, with lowercase "apps" (17.a.iii)
    heroSubline: 'Apps that mind their own business.', // 17.a.ii (the default subline)
    appsHeading: 'Meet our Off-grid apps', // 17.b
    appsHeadingFallback: 'Meet our apps', // 17.b.i (the guard)
    offGridWord: 'Off-grid',
    // 17.c.iii: the popup, word for word. Release 1 (BUWEB-114, the legal
    // reviewer's ruling 1.2): the popup is the short form. "If you buy it, all
    // we keep is your purchase record." is cut (nothing is for sale); the
    // legal reviewer re-reads this when the apps come back.
    popup: 'Off-grid: your data lives on your device, not in our cloud.',
    // 13.a.i: the short form beside every badge.
    shortForm: 'Off-grid: your data lives on your device, not in our cloud.',
    // 13.a.ii on Home: the legend, in its own section right after the hero.
    // Release 1 (BUWEB-114, the legal reviewer's ruling 1.1): "Each app's page
    // lists what it connects to." and "If you buy it, all we keep is your
    // purchase record." are cut, and "the app keeps" is the short form.
    legendOnHome: 'Off-grid: your data lives on your device, not in our cloud. We call Off-grid apps Cloud-killers.',
    // 13.a.ii on an app's own page: the full legend without "Each app's page
    // lists what it connects to." (the connects box sits right below instead).
    legendOnAppPage: 'Off-grid: the app keeps your data on your device, not in our cloud. If you buy it, all we keep is your purchase record. We call Off-grid apps Cloud-killers.',
    // 13.a.ii: the heading of the legend's section, on Home and on each
    // Off-grid app's page. A plain heading: no popup word in it.
    explainedHeading: 'Off-grid, explained',
    // 13.b: each Off-grid app's connects box.
    connects: {
        catche: 'What Catche connects to: its map loads from OpenStreetMap. Like any website, OpenStreetMap sees your IP address. It also sees which part of the map you view, which can hint at where your photos were taken. An optional AI model downloads from Hugging Face, only if you click Download. Catche doesn\'t send your photos, file names or tags anywhere. If your computer lacks a standard Microsoft component (WebView2), the installer may download it from Microsoft.', // 13.b.ii
        timetracker: 'What TimeTracker connects to: nothing. The app makes no internet connections. If your PC lacks a standard Microsoft component (WebView2), the installer downloads it from Microsoft.', // 13.b.i
        vault: 'What Vault connects to: Vault is still being built. As designed, it goes online for just two things: checking your purchase and getting updates. It doesn\'t send your vault or anything in it. If your PC lacks a standard Microsoft component (WebView2), the installer may download it from Microsoft.', // 13.b.v
    },
    // 13.e.ii: on Vault's page, after the connects box, never inside the legend.
    vaultSync: 'Vault (working name) starts on Windows. A later version may add sync between devices. That version would keep an encrypted copy of your vault in our cloud, so it won\'t wear the Off-grid badge.',
    vaultTrust: 'Your vault is saved on your PC, and we keep no copy of it.',
    // 13.e.ii: the trust line, then the sync line, under this heading.
    vaultWhereHeading: 'Where your vault lives',
};

// The popup link on a card or app-page badge (17.c.iv): the box label without
// its colon, and no "(working name)".
export const connectsLabel = (app) => `What ${app.shortName} connects to`;

// Brand colours (6.f), as the browser reports them.
export const COLOUR = {
    navy: 'rgb(0, 42, 66)', // #002A42: text
    green: 'rgb(0, 100, 84)', // #006454: Off-grid only
    red: 'rgb(207, 47, 50)', // #CF2F32: the signup button only
    lightBlue: 'rgb(216, 235, 255)', // #D8EBFF: red never sits on it
    white: 'rgb(255, 255, 255)',
};

// The About page, word for word (spec decision 18; the words as passed by the
// legal reviewer on 2026-10-15, story lines 2 and 3 as he reworded them).
// "Rabbi" is never used alone on the site: only inside the full name. The
// photo files and IDs use the full name too (fojle-rabbi-saikat).
export const ABOUT = {
    path: '/about/',
    // The site's draft label. BUWEB-114 took it off every page; DRAFT_LABEL
    // (below) is kept only so the tests can prove it is gone.
    title: 'Hi. We\'re bengUSA.pro.',
    line: 'We build apps that mind their own business.',
    storyHeading: 'Our story',
    // Release 1's stopgap story (the legal reviewer, 2026-10-18, ruling 1.4).
    // No app is named. BUWEB-115 replaces it.
    story: 'We build software for a living. Now we\'re making apps for you.',
    peopleHeading: 'Who we are',
    people: [
        {
            name: 'Rob Guida',
            title: 'Co-founder & CEO',
            bio: 'He has built software and led development teams for more than 30 years. He designs systems, rescues stuck projects and helps teams choose what to build and what to buy. His tools: AWS, SQL, Node.js, GraphQL, React, Python, Rust and PHP.',
            alt: 'Rob Guida, in glasses, a gray jacket and a light-blue shirt, against a dark blue background.',
            photo: '/images/about/rob-guida.webp',
        },
        {
            name: 'Fojle Rabbi Saikat',
            title: 'Co-founder & CTO',
            bio: 'He has been a software engineer since 2015 and has shipped more than 30 Android apps on Google Play. He designs system architecture, leads teams and builds with Java, Kotlin, Spring Boot, Laravel, Node.js, Vue.js, PostgreSQL and MySQL. He also built the original code for this site.',
            alt: 'Fojle Rabbi Saikat, in glasses and a navy kurta, sitting on a black scooter outdoors.',
            photo: '/images/about/fojle-rabbi-saikat.webp',
        },
    ],
    // PARKED with the apps (on the page only while showApps is on).
    makingHeading: 'What we\'re making',
    making: {
        catche: 'finds your photos.',
        timetracker: 'turns your hours into invoices.',
        vault: 'sorts your dev secrets.',
    },
    // PARKED with Contact (on the page only while showContact is on).
    contactBefore: 'Want to say hi? Use the ',
    contactLink: 'Contact page',
    contactAfter: '.',
    // The old placeholder that must be gone.
    gone: 'Coming in a later draft.',
    // The photos: 480 x 600 files, shown at 240 x 300 (computer) / 200 x 250 (phone).
    photoFile: { width: 480, height: 600, maxBytes: 100 * 1024 },
    shown: { desktop: { width: 240, height: 300 }, phone: { width: 200, height: 250 } },
};

// The draft label that was on every page until BUWEB-114. It must not appear
// anywhere in the build (checks/release1.spec.mjs).
export const DRAFT_LABEL = 'Draft words. Not final.';

// Every line of About's main text, in order, and nothing else (acceptance
// check 26: only the approved words). One entry per block on the page: an
// extra paragraph anywhere, even one with approved words, makes the list
// differ. "What we're making" and the Contact line are in the list only while
// the apps and Contact are shown.
export function aboutMainText() {
    return [
        ABOUT.title,
        ABOUT.line,
        ABOUT.storyHeading,
        ABOUT.story,
        ABOUT.peopleHeading,
        ...ABOUT.people.flatMap((p) => [p.name, p.title, p.bio]),
        ...(SHOW.apps ? [ABOUT.makingHeading, ...APPS.map((app) => `${app.name} ${ABOUT.making[app.id]}`)] : []),
        ...(SHOW.contact ? [`${ABOUT.contactBefore}${ABOUT.contactLink}${ABOUT.contactAfter}`] : []),
    ];
}

// The Privacy page, word for word (the legal reviewer, 2026-10-18,
// icabod-r1-rulings.md section 2: 146 words, final, plain ASCII). The labels
// (H1, intro, H2, P) are not site words. Only the last line differs by build:
// "Last updated: <the day the build was made>", in the form PRIVACY.updated.
export const PRIVACY = {
    path: '/privacy/',
    title: 'Privacy',
    intro: 'This page covers the website at bengusa.pro.',
    sections: [
        {
            heading: 'What our server keeps',
            paragraphs: ['Our server keeps a short visitor log for 14 days: the date and time, your IP address, the pages and files your browser asks for, and the browser and device type it reports. Backup copies of the log are gone within about 3 weeks. We use it to keep the site running and safe, and to count visits. We don\'t sell it or use it for ads.'],
        },
        {
            heading: 'What the site doesn\'t do',
            paragraphs: ['The site has no forms, no cookies, no ads, and no analytics or tracking scripts. It doesn\'t follow you to other sites. Every file, fonts included, comes from our server, which runs on Amazon Web Services in the US.'],
        },
        {
            heading: 'Changes',
            paragraphs: ['If the site starts collecting anything else, or keeps it longer, this page will say so first.'],
        },
    ],
    // The last line, exact as the spec has it (decision 19.f). If the build is
    // made on another day, the spec and this line change together.
    updated: 'Last updated: October 19, 2026.',
    // The page descriptions the legal reviewer pre-cleared (his "page descriptions" list).
    descriptions: {
        '/': 'Makers of Off-grid apps. Off-grid: your data lives on your device, not in our cloud.',
        '/about/': 'Who\'s behind bengUSA.pro, and why we build apps that mind their own business.',
        '/privacy/': 'What the bengusa.pro website keeps, and for how long.',
    },
};

// Every line of the Privacy page's main text, in order, up to the date line
// (which is checked against PRIVACY.updated).
export function privacyMainText() {
    return [
        PRIVACY.title,
        PRIVACY.intro,
        ...PRIVACY.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    ];
}
