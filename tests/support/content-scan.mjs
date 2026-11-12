// Scans out/ for content that must never ship. Text files only (fonts and
// images give false hits), except the Google font hosts, which are also
// looked for inside binary files (a host name cannot appear by chance).
import fs from 'node:fs';
import path from 'node:path';
import { TEXT_EXT, rel, walk } from '../../scripts/lib/export-checks.mjs';

// URL strings that framework code carries but the browser never fetches.
const INERT_URL = [
    /^http:\/\/www\.w3\.org\//, // XML / SVG namespaces
    /^https:\/\/nextjs\.org\/docs\//, // Next error-help text
    /^https:\/\/react\.dev\/errors\//, // React error decoder text
    /^https:\/\/react\.dev\/link\//, // React warning help text
    /^https:\/\/github\.com\/zloirock\/core-js/, // core-js licence text
    /^https?:\/\/(a|x|n|тест)([/@#?]|$)/u, // core-js URL feature tests + Next's server-side URL base, only passed to new URL()
];

// The one outside address the site may link to (BUWEB-128: the "Our U.S. Debt"
// block on Home). Exact match only: a longer host ("...bengusa.pro.example"),
// another sub-domain, a path or plain http is still an outside address and
// still caught. Typed here, not read from content/, so a content edit cannot
// widen the guard.
export const ALLOWED_OUTSIDE_URLS = ['https://bengusa.pro/ourusdebt/'];
export const isAllowedOutsideUrl = (url) => ALLOWED_OUTSIDE_URLS.includes(url);

// An apostrophe as it can appear in out/: typed, curly, or HTML-escaped.
const APOS = String.raw`(?:'|’|&#x27;|&#39;|&apos;|\\u0027)`;

// The old site's content and other strings that must be gone for good.
export const BANNED = {
    // Vault's lines from before it wore the badge (spec 13.e.ii, 2026-10-06).
    retiredVault: [new RegExp(`doesn${APOS}t wear the Off-grid badge`, 'i'), new RegExp(`That${APOS}s why Vault`, 'i'),
        /Sync between devices is planned/i],
    googleFonts: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i],
    llc: [/\bLLC\b/, /\bL\.L\.C\b/i],
    email: [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/],
    oldSite: [/digital[\s_-]*silk/i, /\bxerox\b/i, /\bsony\b/i, /\bNFL\b/, /\bNYU\b/, /\bgrenco\b/i,
        /enchant\.png/i, /babies\s*r\s*us|babiesrus/i, /\bmiami\b/i, /doForms/i, /\bMarcom\b/,
        /Awwwards/i, /north hall/i, /\bP&G\b/, /\bpg\.png\b/i, /\bhp\.png\b/i, /logo10/i,
        /bengusa\.pro@mail\.com/i, /MAINTENANCE_MODE/, /alt="IMA/, /alt="Horizon/, /ComingSoon/],
};

function addHit(list, file, text, index, length) {
    const s = Math.max(0, index - 30);
    list.push(`${file}: …${text.slice(s, index + length + 30).replace(/\s+/g, ' ')}…`);
}

export function scanOut(outDir) {
    const hits = { outsideUrl: [], protocolRelative: [], googleFonts: [], llc: [], email: [], oldSite: [], retiredVault: [] };
    let textCount = 0;
    const files = walk(outDir);
    for (const full of files) {
        const file = rel(outDir, full);
        const ext = path.extname(full).toLowerCase();
        const buf = fs.readFileSync(full);
        const latin = buf.toString('latin1');
        for (const re of BANNED.googleFonts) if (re.test(latin)) hits.googleFonts.push(`${file}: ${re}`);
        if (!TEXT_EXT.has(ext)) continue;
        textCount++;
        const text = buf.toString('utf8');
        for (const m of text.matchAll(/https?:\/\/[^\s"'`<>)\\,;]+/g)) {
            const url = m[0];
            if (/^http:\/\/www\.w3\.org\//.test(url)) continue;
            if (isAllowedOutsideUrl(url)) continue; // the one approved outside link (BUWEB-128)
            if (ext === '.js' && INERT_URL.some((re) => re.test(url))) continue;
            addHit(hits.outsideUrl, file, text, m.index, url.length);
        }
        for (const m of text.matchAll(/(?:src|href|srcset|action|poster)\s*=\s*["']\/\/[^"']+|url\(\s*["']?\/\/[^)]+/gi)) {
            addHit(hits.protocolRelative, file, text, m.index, m[0].length);
        }
        for (const cat of ['llc', 'email', 'oldSite', 'retiredVault']) {
            for (const re of BANNED[cat]) {
                for (const m of text.matchAll(new RegExp(re.source, `${re.flags}g`))) {
                    addHit(hits[cat], file, text, m.index, m[0].length);
                }
            }
        }
    }
    return { files: files.length, textCount, hits };
}

// Phone-number SHAPES (any number, not a specific one), for the About page
// scan (tests/checks/about-files.spec.mjs). Used on visible text and words files
// only: script files hold long digit runs that are not phone numbers.
export const PHONE_SHAPES = [
    /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, // 10 digits, with or without a leading 1
    /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)/g, // international, starts with +
];

export function findPhones(text) {
    return PHONE_SHAPES.flatMap((re) => [...text.matchAll(re)].map((m) => m[0].trim()));
}
