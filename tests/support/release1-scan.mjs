// The scans behind tests/checks/release1.spec.mjs (BUWEB-114, Release 1: the
// real site with the apps and Contact hidden). Each scan is a plain function
// over file text, so the spec can run it on the real build AND on made-up bad
// strings (a check that cannot fail proves nothing).
//
// Every scan returns ALL its hits as readable lines ("file: ...context..."),
// never the first one only (Rob's loop rule: one bad item must not hide the
// others).
import fs from 'node:fs';
import path from 'node:path';
import { RABBI_ALONE_VARIANTS } from './words.mjs';
import { isAllowedOutsideUrl } from './content-scan.mjs';
import { OUT_DIR, ROOT, readJson, rel, retiredIds, textFiles, walk } from '../../scripts/lib/export-checks.mjs';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\x5c]/g, (c) => String.fromCharCode(92) + c);

export function around(text, index, length) {
    const s = Math.max(0, index - 30);
    return `…${text.slice(s, index + length + 30).replace(/\s+/g, ' ')}…`;
}

// All matches of every { label, re } in one text, as lines.
export function termHits(file, text, terms) {
    const hits = [];
    for (const { label, re } of terms) {
        for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) {
            hits.push(`${file}: ${label}: ${around(text, m.index, m[0].length)}`);
        }
    }
    return hits;
}

// Reads every text file in out/ (html, js, css, json, txt, map...).
export function outTexts(dir = OUT_DIR) {
    return textFiles(dir).map((full) => ({ file: rel(dir, full), text: fs.readFileSync(full, 'utf8') }));
}

// ---------------------------------------------------------------------------
// 1. No app name, short name, slug or ID anywhere in out/.
// The names come from content/apps.json (kept while the apps are hidden) and
// the retired-ID ledger, so a new app is covered without editing this file.
// ---------------------------------------------------------------------------
export function appTerms(root = ROOT) {
    const apps = readJson(path.join(root, 'content', 'apps.json'));
    const words = new Set(['catche', 'timetracker', 'time tracker', 'time-tracker', 'vault', 'working name']);
    for (const a of apps) {
        for (const w of [a.id, a.slug, a.shortName, a.name]) if (typeof w === 'string') words.add(w.toLowerCase());
    }
    for (const id of retiredIds(root)) words.add(id.toLowerCase());
    // Names shorter than 4 letters would hit ordinary code; every real name is longer.
    const terms = [...words].filter((w) => w.length >= 4).sort().map((w) => ({
        label: `app name "${w}"`,
        re: new RegExp(w.split(/[\s-]+/).map(escapeRe).join('[\\s-]*'), 'gi'),
    }));
    // A path into the app pages: "/apps/..." or "/apps" closing a quote.
    terms.push({ label: 'a path into /apps', re: /\/apps(?:\/|(?=["'`\x5c]))/g });
    return terms;
}

// ---------------------------------------------------------------------------
// 2. Hidden pages: no link to them, nothing built for them.
// ---------------------------------------------------------------------------
export const CONTACT_TERMS = [{ label: 'a path to /contact', re: /\/contact(?:\/|(?=["'`\x5c#?]))/g }];

// Every href="..." in one HTML text that does not reach a shown page or a
// file that exists in out/. "shown" = route list with trailing slashes.
export function badHrefs(file, html, shown, outDir = OUT_DIR) {
    const hits = [];
    for (const m of html.matchAll(/\bhref\s*=\s*"([^"]*)"/g)) {
        const href = m[1];
        if (href.startsWith('#')) continue;
        const clean = href.split('#')[0].split('?')[0];
        if (isAllowedOutsideUrl(href)) continue; // the one approved outside link (BUWEB-128)
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
            hits.push(`${file}: href to another address "${href}"`);
            continue;
        }
        if (shown.includes(clean)) continue;
        const onDisk = path.join(outDir, clean.replace(/^\//, ''));
        if (clean.startsWith('/') && fs.existsSync(onDisk) && fs.statSync(onDisk).isFile()) continue;
        hits.push(`${file}: href "${href}" reaches no shown page and no file in out/`);
    }
    return hits;
}

// Files in out/ that exist only for a hidden page: a folder or file named
// apps or contact, a page-data file for either, or a name that carries an app
// slug. `files` = paths relative to out/.
export function hiddenFileHits(files, slugs) {
    const hits = [];
    const slugRe = slugs.length ? new RegExp(slugs.map(escapeRe).join('|'), 'i') : null;
    for (const f of files) {
        if (/(^|\/)(apps|contact)(\/|\.|$)/i.test(f) || /__next\.(apps|contact)/i.test(f)) hits.push(`${f}: a file for a hidden page`);
        else if (/contact/i.test(f) || /(^|[^a-z0-9])apps([^a-z0-9]|$)/i.test(f) || (slugRe && slugRe.test(f))) hits.push(`${f}: a file name that points at a hidden page`);
    }
    return hits;
}

// ---------------------------------------------------------------------------
// 3. No draft label.
// ---------------------------------------------------------------------------
export const DRAFT_TERMS = [
    { label: '"Draft words"', re: /Draft words/gi },
    { label: '"Not final"', re: /\bNot final\b/gi },
];

// ---------------------------------------------------------------------------
// 5. Nothing from an outside host, and nothing the browser could be told to
// run or style inline (the CSP has no 'unsafe-inline').
// ---------------------------------------------------------------------------
export const OUTSIDE_HOSTS = [{
    label: 'an analytics, CDN or font host',
    re: /\b(?:googletagmanager\.com|google-analytics\.com|doubleclick\.net|facebook\.net|fbcdn\.net|cdnjs\.cloudflare\.com|unpkg\.com|jsdelivr\.net|gstatic\.com|googleapis\.com|hotjar\.com|segment\.(?:io|com)|plausible\.io)\b/gi,
}];

export const INLINE_TERMS = [
    { label: 'an inline <style> tag', re: /<style\b/gi },
    { label: 'an inline style="" attribute', re: /\sstyle\s*=\s*["']/gi },
    { label: 'an inline event handler', re: /\son[a-z]{3,}\s*=\s*["']/gi },
    { label: 'a javascript: link', re: /["']javascript:/gi },
];

// Every url(...) in a CSS text that does not reach a file in out/.
export function badCssUrls(file, css, outDir = OUT_DIR) {
    const hits = [];
    for (const m of css.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)) {
        const url = m[2].trim();
        if (url.startsWith('data:')) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) {
            hits.push(`${file}: url() to another address "${url}"`);
            continue;
        }
        const clean = url.split('#')[0].split('?')[0];
        const full = clean.startsWith('/') ? path.join(outDir, clean) : path.join(outDir, path.dirname(file), clean);
        if (!fs.existsSync(full)) hits.push(`${file}: url() "${url}" is not a file in out/`);
    }
    return hits;
}

// ---------------------------------------------------------------------------
// 6. "Rabbi", "Saikat" and "Fojle" never alone: only inside the full name
// (text) or fojle-rabbi-saikat (file name or ID), across the WHOLE build.
// ---------------------------------------------------------------------------
export const FULL_NAME_FORMS = ['Fojle Rabbi Saikat', 'fojle-rabbi-saikat'];

export function bareNames(where, text) {
    // The one allowed bare "Rabbi": the About intro line (BUWEB-115, spec 18.c.iii).
    let rest = text;
    for (const v of RABBI_ALONE_VARIANTS) rest = rest.split(v).join(' '.repeat(v.length));
    // Blanked out at the same length, so each hit's position is unchanged.
    for (const form of FULL_NAME_FORMS) rest = rest.split(form).join(' '.repeat(form.length));
    const hits = [];
    for (const re of [/rabbi/gi, /saikat/gi, /fojle/gi]) {
        for (const m of rest.matchAll(re)) hits.push(`${where}: "${m[0]}" alone: ${around(text, m.index, m[0].length)}`);
    }
    return hits;
}

// ---------------------------------------------------------------------------
// The shown pages, as links (trailing slash).
// ---------------------------------------------------------------------------
export const asLinks = (routes) => routes.map((r) => (r === '/' ? '/' : `${r}/`));

export { walk };
