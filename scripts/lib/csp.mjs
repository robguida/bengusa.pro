// The Content Security Policy for the static export (BUWEB-114).
//
// A static site has no server to add a per-request nonce, and Next's inline
// scripts differ on every page and change with every build (the page's data
// payload). So after `next build`, scripts/build.mjs writes each page's own
// policy into that page, as a <meta http-equiv="Content-Security-Policy"> tag
// right after <meta charSet>, before any script or stylesheet. It carries the
// sha256 hash of every inline script on that page and nothing else inline.
// The hashes are worked out on every build, never typed by hand.
//
// The policy: nothing from another host, ever (Cora 2.9). Scripts, styles,
// images, fonts and page data come from the site itself; no inline style, no
// plugin, no <base>, no form.
//
// A meta policy can't set frame-ancestors, report-uri or sandbox. The web
// server sends one fixed header for those (Otto's nginx). That header must NOT
// set script-src or default-src: the browser applies both policies, and a
// fixed one would block these pages' own inline scripts.
//
// The Windows export fix (scripts/release/fix-windows-export.mjs) only renames
// page-data .txt files, so it never changes a page or its hashes.
// No packages: Node built-ins only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, rel, walk } from './export-checks.mjs';

export const CSP_DIRECTIVES = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'"]], // + the page's inline-script hashes
    ['style-src', ["'self'"]],
    ['img-src', ["'self'"]],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
];

const CHARSET = '<meta charSet="utf-8"/>';
const META_RE = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"\/>/g;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

// The hash a browser computes: over the script's text as the HTML parser
// passes it on, with CR LF and a lone CR turned into LF.
export function scriptHash(text) {
    const digest = crypto.createHash('sha256').update(text.replace(/\r\n?/g, '\n'), 'utf8').digest('base64');
    return `'sha256-${digest}'`;
}

// The text of every script on the page that has no src (each one is hashed,
// however many there are: a bigger page splits its data into more scripts).
export function inlineScripts(html) {
    return [...html.matchAll(SCRIPT_RE)].filter((m) => !/\ssrc\s*=/i.test(m[1])).map((m) => m[2]);
}

export function policyFor(hashes) {
    return CSP_DIRECTIVES
        .map(([name, values]) => [name, ...values, ...(name === 'script-src' ? hashes : [])].join(' '))
        .join('; ');
}

const pageHashes = (html) => [...new Set(inlineScripts(html).map(scriptHash))];
const htmlFiles = (outDir) => walk(outDir).filter((f) => path.extname(f).toLowerCase() === '.html');

// Writes each page's policy. Every page is tried, and every problem listed.
export function injectCsp(outDir = OUT_DIR) {
    const problems = [];
    let pages = 0;
    for (const file of htmlFiles(outDir)) {
        const name = rel(outDir, file);
        try {
            const html = fs.readFileSync(file, 'utf8');
            const charsets = html.split(CHARSET).length - 1;
            if (charsets !== 1) {
                problems.push(`${name}: expected one ${CHARSET}, found ${charsets}; no policy written`);
                continue;
            }
            if ([...html.matchAll(META_RE)].length) {
                problems.push(`${name}: already has a Content-Security-Policy meta tag; no policy written`);
                continue;
            }
            const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(pageHashes(html))}"/>`;
            fs.writeFileSync(file, html.replace(CHARSET, () => `${CHARSET}${meta}`));
            pages += 1;
        } catch (err) {
            problems.push(`${name}: ${err.message}`);
        }
    }
    return { ok: problems.length === 0, pages, problems };
}

// Every page: exactly one policy, first in <head> after the charset, that is
// exactly the site policy with exactly this page's inline-script hashes; and
// nothing on the page that the policy would block (inline styles, inline event
// handlers, javascript: links). Lists every problem on every page.
export function checkCsp(outDir = OUT_DIR) {
    const problems = [];
    const files = htmlFiles(outDir);
    for (const file of files) {
        const name = rel(outDir, file);
        const html = fs.readFileSync(file, 'utf8');
        const metas = [...html.matchAll(META_RE)];
        if (metas.length !== 1) {
            problems.push(`${name}: ${metas.length} Content-Security-Policy meta tags (want exactly 1)`);
        } else {
            const at = metas[0].index;
            if (html.slice(at - CHARSET.length, at) !== CHARSET) problems.push(`${name}: the policy is not right after ${CHARSET}`);
            for (const tag of ['<script', '<link', '<style']) {
                const first = html.indexOf(tag);
                if (first > -1 && first < at) problems.push(`${name}: a ${tag}> comes before the policy, so the policy does not cover it`);
            }
            const want = policyFor(pageHashes(html));
            if (metas[0][1] !== want) problems.push(`${name}: the policy does not match this page's inline scripts (rebuild): has "${metas[0][1]}", want "${want}"`);
        }
        // Script text is set aside, so words inside the page data never count.
        const markup = html.replace(SCRIPT_RE, (m, attrs) => `<script${attrs}></script>`);
        if (/<style\b/i.test(markup)) problems.push(`${name}: a <style> element (inline styles are blocked)`);
        for (const [tag] of markup.matchAll(/<[a-zA-Z][\w-]*\b[^>]*>/g)) {
            if (/\sstyle\s*=/i.test(tag)) problems.push(`${name}: an inline style attribute (blocked): ${tag.slice(0, 120)}`);
            if (/\son[a-z]+\s*=/i.test(tag)) problems.push(`${name}: an inline event handler (blocked): ${tag.slice(0, 120)}`);
            if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(tag)) problems.push(`${name}: a javascript: link (blocked): ${tag.slice(0, 120)}`);
        }
    }
    return { ok: problems.length === 0, pages: files.length, problems };
}
