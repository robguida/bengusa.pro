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

// The "Our U.S. Debt" block under "Apps coming soon!" on Home (BUWEB-128, Rob 2026-11-12).
export const USDEBT = {
    leadIn: 'While you wait, try a tool we built.',
    title: 'Our U.S. Debt',
    text: 'See the U.S. national debt day by day, from public U.S. Treasury data that is updated each business day and goes back to 1993. Pick any dates to get a chart, stats and the numbers behind them, plus a trend line that looks ahead. You can also compare how the debt changed during each presidential term.',
    linkText: 'Try Our U.S. Debt at bengusa.pro/ourusdebt \u2192',
    newTabHint: ' (opens in a new tab)',
    url: 'https://bengusa.pro/ourusdebt/',
    // BUWEB-134: the picture beside the block.
    image: {
        src: '/images/usdebt/ourusdebt-chart.webp',
        alt: 'A screenshot of the Our U.S. Debt tool: a line chart of the U.S. national debt over time, in trillions of dollars, with a red trend line that looks ahead.',
    },
};

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

// The About page, word for word (BUWEB-115: "Two developers. Two countries.
// One team."; the final words, cleared by the legal reviewer 2026-10-22).
// ABOUT_BLOCKS is every block of the page in order: [kind, text]. Kinds:
// h1, h2, h3 (headings), b (a bold line or label), p (a paragraph). The
// markdown marks (**, *) are not part of the words. A "b" label that sits
// inside a person's block is a bold label, not a heading.
export const ABOUT_BLOCKS = [
    ["h1", "About Us"],
    ["h2", "Two developers. Two countries. One team."],
    ["p", "From opposite sides of the world, Rob and Rabbi met a few years ago while working on a client project. They have been partners in business ever since. They enjoyed building software together, challenging each other's ideas, and figuring out solutions to difficult problems. That working relationship turned into a friendship."],
    ["h2", "Meet the Founders"],
    ["h3", "Rob Guida"],
    ["b", "Co-founder & CEO"],
    ["p", "Rob has spent more than 30 years building software, designing systems, and leading development teams. He's worked on everything from individual applications to large enterprise platforms."],
    ["p", "He enjoys solving complicated problems, especially when the result makes someone's work or life a little easier."],
    ["p", "Lately Rob has been putting his experience to work with AI. He runs his own team of AI agents, set up like a small software company, with each one in a defined role and everything working to a written rulebook. He's passionate about AI-assisted development because it lets people with good ideas build better, and it helps most when they already know how to code, since they can tell good work from a draft that still needs fixing. The final call on every plan and every release is still his."],
    ["p", "His technical background includes AWS, SQL, Node.js, GraphQL, React, Python, Rust, and PHP."],
    ["h3", "Fojle Rabbi Saikat"],
    ["b", "Co-founder & CTO"],
    ["p", "He has been developing software since 2015, starting with Android applications. He's released more than 30 Android apps on Google Play and has worked across nearly every part of software development."],
    ["p", "From mobile apps and user interfaces to backend systems, databases, automation, and system architecture, he enjoys the technical challenges that come with turning ideas into working applications."],
    ["p", "He also developed the original code for the bengUSA website."],
    ["p", "His technical background includes Java, Kotlin, Spring Boot, Laravel, PHP, Node.js, Vue.js, JavaScript, PostgreSQL, MySQL, CI/CD, Docker, Redis, and AWS."],
    ["h2", "So, what's with the name?"],
    ["p", "bengUSA brings together Bangladesh and the United States, the two countries we're from. The “Beng” comes from Bengali, and “beng usa”, or “ben gusa”, sounds better than “bang usa”. Since the USA is still the melting pot of the world, it is best to be clear, Rob Guida is from the USA and Fojle Rabbi Saikat is from Bangladesh."],
    ["h2", "Why build apps ourselves?"],
    ["p", "After years of building software for other people, we wanted the freedom to pursue our own ideas."],
    ["p", "We both have plenty of them. Probably more than we'll ever have time to build."],
    ["p", "But that's part of the fun. We get to take an idea, figure out how to make it work, and turn it into something people can actually use."],
    ["h2", "What is “Off-grid”?"],
    ["p", "Not every app needs a server somewhere collecting your information. Sometimes you just want a useful tool that works without handing over your data."],
    ["p", "That's the idea behind our Off-grid apps. Your app data stays on your device instead of being stored in our cloud."],
    ["p", "We're not interested in collecting your personal information just because we can."],
    ["b", "Your data, your call."],
];

// The founders' "own words" blocks. HIDDEN on the one-page site (2026-11-02,
// "showOwnWords": false in content/about-words.json): their words stay, and
// the tests that check them are parked. Not part of ABOUT_BLOCKS while hidden.
export const OWN_WORDS_BLOCKS = [
    ["b", "In Rob's own words"],
    ["b", "Something I'm proud of"],
    ["p", "Years ago, I built a government budget and project-planning system that let people browse departments, offices, budgets, and projects using a familiar folder structure instead of searching for codes and names. It seems simple today, but it was a different way of doing things at the time. When several offices consolidated their systems, mine was the one they kept. That still makes me smile."],
    ["b", "When I'm not working"],
    ["p", "I love cooking, eating, walking, exploring new places, and writing. My Christian faith is an important part of my life, especially my journey from atheism to Christianity."],
    ["b", "Life on the road"],
    ["p", "My wife and I love slow travel. We like staying somewhere long enough to experience everyday life rather than just checking attractions off a list. And no, we're not RV or tent people. Give us a comfortable apartment or a nice hotel."],
    ["b", "A trip I'll never forget"],
    ["p", "My wife and I once saw Switzerland's Maloja Pass on a computer screensaver and decided we had to drive it. So we did. We even stayed in a grand old hotel along the way. Beautiful, a little eerie, and almost like something out of The Shining. What an experience."],
    ["b", "Something that surprises people"],
    ["p", "I can still sprint up a pretty steep hill. I'm not saying I look graceful doing it, and the recovery isn't what it used to be, but I can do it."],
    ["b", "In his own words"],
    ["b", "How Rob and I met"],
    ["p", "A colleague introduced us. He and Rob were already working together for a mutual client, and they needed another developer. I joined the team, and our work together began there."],
    ["b", "Why I build apps with Rob"],
    ["p", "Rob quickly became more of a friend than a colleague. He's a helpful problem solver and a great mentor. Over the years we've tackled countless technical challenges together and delivered projects we're proud of. Our visions line up, and we know how to execute and deliver as a team. So we decided to build apps together."],
    ["b", "What I enjoy most"],
    ["p", "Building an app is a digital form of problem-solving. Every app has its own story and the chance to solve a real human problem. It's architectural engineering for your daily life. What I love most is designing the blueprint. Knowing a system I designed can make someone's life a little easier is what makes me most proud. It's not just about making a living. It's about putting something useful out into the world. Software is my passion, and after all these years, I still love what I do."],
    ["b", "Where I'm based"],
    ["p", "I'm based in Dhaka, Bangladesh. Rob and I are on opposite sides of the world, and it has never stopped us from building software together. Bringing our two countries together is what inspired the name bengUSA."],
];


// "Rabbi" alone is allowed ONLY in this line (spec 18.c.iii, changed for BUWEB-115).
export const RABBI_ALONE_LINE = ABOUT_BLOCKS[2][1];

// Phrases that must never be on the About page (any case). "sensitive" and
// "HIPAA" stay banned. Allowed, and must not trip the check: client,
// Bangladesh, USA, AI, Off-grid, privacy, wife.
export const ABOUT_BANNED = [
    'our own app', 'apps are ours', 'We are sovereign', 'split the apps', 'divide up the apps',
    'our partnership', 'still run well', 'sensitive', 'HIPAA',
];

// The four photos (each 480 x 600, no metadata): headshot first, then personal.
const rob = { name: 'Rob Guida', headshot: '/images/about/rob-guida.webp', personal: '/images/about/rob-guida-personal.webp' };
const co = { name: 'Fojle Rabbi Saikat', headshot: '/images/about/fojle-rabbi-saikat.webp', personal: '/images/about/fojle-rabbi-saikat-personal.webp' };
export const ABOUT = {
    path: '/about/', // its own live page again (BUWEB-133)
    title: 'About Us',
    makingHeading: "What we're making",
    contactLink: 'Contact page',
    contactBefore: 'Want to say hi? Use the ',
    contactAfter: '.',
    gone: 'Coming in a later draft.',
    people: [
        { ...rob, headshotAlt: 'Rob Guida, in glasses, a gray jacket and a light-blue shirt, against a dark blue background.',
            personalAlt: 'Rob Guida in a night selfie, in a black beanie, with a frosted gray knit scarf pulled up over his mouth and frost on his eyelid.' },
        { ...co, headshotAlt: 'Fojle Rabbi Saikat, in glasses and a navy kurta, outdoors with greenery behind him.',
            personalAlt: 'Fojle Rabbi Saikat, in glasses and a navy kurta, sitting on a black scooter outdoors.' },
    ],
    photoFile: { width: 480, height: 600, maxBytes: 100 * 1024 },
};

// Every line of About's main text, in order, and nothing else.
export function aboutMainText() {
    return ABOUT_BLOCKS.map(([, text]) => text);
}


// The draft label that was on every page until BUWEB-114. It must not appear
// anywhere in the build (checks/release1.spec.mjs).
export const DRAFT_LABEL = 'Draft words. Not final.';

// The Privacy page, word for word (the legal reviewer, 2026-10-18,
// icabod-r1-rulings.md section 2: 217 words, final, plain ASCII; reworded 2026-11-13 for Our U.S. Debt, bengusa_privacy_ourusdebt_2026-11-13.md). The labels
// (H1, intro, H2, P) are not site words. The last line is
// "Last updated: <the day the Privacy words last changed>", in the form
// PRIVACY.updated (the legal reviewer's date ruling, 2026-10-19). It does not
// move for a build, a merge or a deploy; when a Privacy word changes, it
// changes in the same commit, here, in content/ and in spec 19.f.
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
            paragraphs: ['The site has no sign-up or contact forms, no cookies, no ads, and no analytics or tracking scripts. It doesn\'t follow you to other sites. Every file, fonts included, comes from our server in the US, through Amazon Web Services.'],
        },
        {
            heading: 'Our U.S. Debt',
            paragraphs: [
                'Our U.S. Debt, at bengusa.pro/ourusdebt, is part of this site. Its forms only let you choose what the charts show, such as dates or presidential terms. They don\'t ask anything about you.',
                'If you switch its trend line on or off, your browser saves that choice. It isn\'t a cookie, and the saved copy stays in your browser. Clearing this site\'s data in your browser removes it.',
            ],
        },
        {
            heading: 'Changes',
            paragraphs: ['If the site starts collecting anything else, or keeps it longer, this page will say so first.'],
        },
    ],
    // The last line, exact as the spec has it (decision 19.f). If the build is
    // made on another day, the spec and this line change together.
    updated: 'Last updated: November 13, 2026.',
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

// The intro line as it can appear in out/: typed, curly, or HTML/JSON-escaped apostrophe.
export const RABBI_ALONE_VARIANTS = ["'", '’', '&#x27;', '&#39;', '&apos;', '\u0027'].map((a) => RABBI_ALONE_LINE.replace("'", a));
