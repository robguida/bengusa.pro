// The approved words and colours, copied from the v1 spec (docs/requirements.md).
// Tests compare the pages against THESE, never against content/*.json, so a
// content edit that drifts from the spec turns a test red. When the spec's
// words change, change them here in the same commit.
import path from 'node:path';
import { ROOT, readJson } from '../../scripts/lib/export-checks.mjs';

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
    // 17.c.iii: the popup, word for word.
    popup: 'Off-grid: your data lives on your device, not in our cloud. If you buy it, all we keep is your purchase record.',
    // 13.a.i: the short form beside every badge.
    shortForm: 'Off-grid: your data lives on your device, not in our cloud.',
    // 13.a.ii on Home: the full legend, every sentence kept, in its own
    // section between the hero and the app grid (17.a.v).
    legendOnHome: 'Off-grid: the app keeps your data on your device, not in our cloud. If you buy it, all we keep is your purchase record. Each app\'s page lists what it connects to. We call Off-grid apps Cloud-killers.',
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
