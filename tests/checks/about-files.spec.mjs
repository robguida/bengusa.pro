// The About page's files (spec decision 18, acceptance check 26.d), checked on
// the committed files, with no browser:
//   - the two photos in public/images/about/: no metadata of any kind, sRGB,
//     480 x 600, each at most 100 KB;
//   - the public-folder allow-list holds exactly those two paths;
//   - "Rabbi" and "Fojle" only inside the full name (spec 18.c.iii), in every
//     built About file and in every file name in public/ and out/;
//   - no phone-number shape in the About words or the built About page.
// Every check is soft and every loop reports every bad item, so one failure
// never hides another.
// Nothing here names a real person's employer, client, school, city, phone or
// reference: a banned pattern that named one would itself leak it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { test, expect } from '@playwright/test';
import { ROOT, OUT_DIR, rel, walk } from '../../scripts/lib/export-checks.mjs';
import { readFixtureList } from '../support/fixtures.mjs';
import { ABOUT, RABBI_ALONE_LINE, RABBI_ALONE_VARIANTS } from '../support/words.mjs';
import { PHONE_SHAPES, findPhones } from '../support/content-scan.mjs';

const DIR = path.join(ROOT, 'public', 'images', 'about');
const FILES = ABOUT.people.flatMap((p) => [p.headshot, p.personal].map((src) => ({ name: p.name, rel: src.replace(/^\//, ''), file: path.join(ROOT, 'public', src.replace(/^\//, '')) })));

// Words that must not be anywhere in the bytes of a photo (the camera's and
// the phone's own marks, location, and the metadata containers).
const BANNED_BYTES = ['Exif', 'GPS', 'xmpmeta', 'Apple', 'iPhone', 'ICCP', 'XMP ', 'EXIF', 'IPTC', 'Photoshop', 'http://ns.adobe.com'];

// The chunks a plain, metadata-free WebP may hold.
const PLAIN_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);

// The co-founder's full name, as text and as a file name or ID. "Rabbi" and
// "Fojle" may appear only inside one of these (spec 18.c.iii: never the
// nickname alone, never the short name alone, anywhere on the site).
const FULL_NAME_FORMS = ['Fojle Rabbi Saikat', 'fojle-rabbi-saikat'];
const NAME_PARTS = [/rabbi/gi, /fojle/gi];

// Every bare "Rabbi" or "Fojle" (any case) in text, each with where it is.
function bareNameParts(text, where) {
    let rest = text;
    // Blanked out at the same length, so each hit's position is unchanged.
    // The one allowed bare "Rabbi": the About intro line (BUWEB-115, spec 18.c.iii).
    for (const form of [...RABBI_ALONE_VARIANTS, ...FULL_NAME_FORMS]) rest = rest.split(form).join(' '.repeat(form.length));
    const hits = [];
    for (const re of NAME_PARTS) {
        for (const m of rest.matchAll(re)) {
            const around = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ');
            hits.push(`${where}: "${m[0]}" alone: …${around}…`);
        }
    }
    return hits;
}

function chunks(buf) {
    expect.soft(buf.toString('latin1', 0, 4), 'RIFF header').toBe('RIFF');
    expect.soft(buf.toString('latin1', 8, 12), 'WEBP header').toBe('WEBP');
    expect.soft(buf.readUInt32LE(4) + 8, 'RIFF length matches the file').toBe(buf.length);
    const list = [];
    for (let at = 12; at + 8 <= buf.length;) {
        const id = buf.toString('latin1', at, at + 4);
        const size = buf.readUInt32LE(at + 4);
        list.push({ id, at, size });
        at += 8 + size + (size % 2);
    }
    return list;
}

test.describe('About photos (committed files)', () => {
    test('public/images/about/ holds exactly the four photos, and the allow-list names exactly those', () => {
        expect.soft(fs.readdirSync(DIR).sort(), 'files in public/images/about/').toEqual(FILES.map((f) => path.basename(f.file)).sort());
        const allowed = readFixtureList('public-allowlist.txt').filter((p) => p.startsWith('images/about/'));
        expect.soft(allowed.sort(), 'About lines in fixtures/public-allowlist.txt').toEqual(FILES.map((f) => f.rel).sort());
    });

    // One test per photo, so a bad photo never hides the other. Inside, every
    // check is soft, so a wrong size never hides a metadata result.
    for (const f of FILES) {
        test(`${f.rel}: no exif, xmp, iptc or icc; sRGB; 480x600; at most 100 KB`, async () => {
            const buf = fs.readFileSync(f.file);
            expect.soft(buf.length, 'size in bytes').toBeLessThanOrEqual(ABOUT.photoFile.maxBytes);
            expect.soft(buf.length, 'size in bytes: a real photo').toBeGreaterThan(1000);

            // 1. The file's own chunks: only picture data.
            const list = chunks(buf);
            const ids = list.map((c) => c.id);
            expect.soft(ids.filter((id) => !PLAIN_CHUNKS.has(id)), `unexpected chunks (all: ${ids.join(', ')})`).toEqual([]);
            const x = list.find((c) => c.id === 'VP8X');
            if (x) {
                const flags = buf[x.at + 8];
                expect.soft(flags & 0x20, 'VP8X ICC-profile flag').toBe(0);
                expect.soft(flags & 0x08, 'VP8X EXIF flag').toBe(0);
                expect.soft(flags & 0x04, 'VP8X XMP flag').toBe(0);
            }

            // 2. The decoder's report (sharp, already in node_modules via Next).
            // A file it cannot read is a soft failure here, so the byte search
            // below still runs.
            let meta = {};
            try {
                meta = await sharp(buf).metadata();
            } catch (err) {
                expect.soft(err.message, 'the decoder can read the file').toBe('');
            }
            expect.soft(meta.format).toBe('webp');
            expect.soft([meta.width, meta.height], 'pixel size').toEqual([ABOUT.photoFile.width, ABOUT.photoFile.height]);
            expect.soft(meta.space, 'colour space').toBe('srgb');
            expect.soft(meta.hasProfile, 'no colour profile').toBeFalsy();
            expect.soft(meta.icc, 'icc').toBeUndefined();
            expect.soft(meta.exif, 'exif').toBeUndefined();
            expect.soft(meta.xmp, 'xmp').toBeUndefined();
            expect.soft(meta.iptc, 'iptc').toBeUndefined();
            expect.soft(meta.tifftagPhotoshop, 'photoshop block').toBeUndefined();

            // 3. The bytes: none of the marks, anywhere.
            const latin = buf.toString('latin1');
            for (const word of BANNED_BYTES) expect.soft(latin.includes(word), `"${word}" found in the bytes`).toBe(false);
        });
    }
});

test.describe('the full name only (spec 18.c.iii)', () => {
    test('every built About file (the page and its data files) holds "Rabbi" and "Fojle" only inside the full name', () => {
        const dir = path.join(OUT_DIR, 'about');
        const files = walk(dir).map((full) => ({ name: rel(dir, full), text: fs.readFileSync(full, 'utf8') }));
        const names = files.map((f) => f.name);
        // The scan only means something if it reads the page AND its data files.
        expect.soft(names, 'out/about/ holds the page').toContain('index.html');
        expect.soft(names.filter((n) => n.startsWith('__next')), `out/about/ holds the page's data files (all: ${names.join(', ')})`).not.toEqual([]);
        const seen = files.reduce((n, f) => n + (f.text.match(/rabbi/gi)?.length ?? 0), 0);
        expect.soft(seen, 'the full name is in the built files at all').toBeGreaterThan(0);
        const hits = files.flatMap((f) => bareNameParts(f.text, `out/about/${f.name}`));
        expect.soft(hits, 'bare "Rabbi" or "Fojle" in the built About files').toEqual([]);
    });

    test('no file name in public/ or out/ holds "Rabbi" or "Fojle" except as fojle-rabbi-saikat', () => {
        for (const [label, dir] of [['public', path.join(ROOT, 'public')], ['out', OUT_DIR]]) {
            const hits = walk(dir).flatMap((full) => bareNameParts(rel(dir, full), `${label}/`));
            expect.soft(hits, `bare "Rabbi" or "Fojle" in a file name in ${label}/`).toEqual([]);
        }
    });

    test('the name check catches a bare "Rabbi" or "Fojle", in any case (made-up lines)', () => {
        const caught = ['Rabbi built it', 'by rabbi', '/images/about/rabbi.webp', '"id":"RABBI"', 'Fojle said hi', 'fojle-saikat.webp', 'Fojle-Rabbi-Saikat.webp', `${RABBI_ALONE_LINE} Rabbi said hi`, "We're Rob and Rabbi, two developers"];
        for (const s of caught) expect.soft(bareNameParts(s, 'test').length, s).toBeGreaterThan(0);
        const fine = ['Fojle Rabbi Saikat, in glasses', '/images/about/fojle-rabbi-saikat.webp', '["$","li","fojle-rabbi-saikat"', RABBI_ALONE_LINE];
        for (const s of fine) expect.soft(bareNameParts(s, 'test'), s).toEqual([]);
    });
});

test.describe('phone-number shapes', () => {
    test('the pattern catches the common shapes (made-up numbers only)', () => {
        const caught = [
            '555-010-0199', '(555) 010-0199', '555.010.0199', '+1 555 010 0199', '+44 20 7946 0000', '5550100199', '1-800-555-0100',
        ];
        for (const s of caught) expect.soft(findPhones(`Call ${s} today`).length, s).toBeGreaterThan(0);
        const fine = [
            'more than 30 years', 'since 2015', '240 x 300', 'Node.js 24', 'in 2026-10-15', 'AWS, SQL, Node.js, GraphQL', '480x600',
        ];
        for (const s of fine) expect.soft(findPhones(s), s).toEqual([]);
        expect.soft(PHONE_SHAPES.length).toBeGreaterThan(0);
    });

    test('the About words and the built About page hold none', () => {
        const words = fs.readFileSync(path.join(ROOT, 'content', 'about-words.json'), 'utf8');
        expect.soft(findPhones(words), 'content/about-words.json').toEqual([]);
        const html = fs.readFileSync(path.join(OUT_DIR, 'about', 'index.html'), 'utf8');
        // Visible text and attributes only: no scripts or styles (they hold long digit runs).
        const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
        expect.soft(findPhones(visible), 'out/about/index.html (text)').toEqual([]);
        const alts = [...html.matchAll(/\balt="([^"]*)"/g)].map((m) => m[1]).join('\n');
        expect.soft(findPhones(alts), 'out/about/index.html (alt text)').toEqual([]);
    });
});

test.describe('raw photo source name', () => {
    test('"rob-finland-raw" is nowhere in the repo or in a file name', () => {
        const skip = new Set(['node_modules', '.git', '.next', 'test-results', 'playwright-report']);
        const self = fileURLToPath(import.meta.url);
        const hits = [];
        const scan = (dir) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                if (skip.has(e.name)) continue;
                const full = path.join(dir, e.name);
                if (/rob-finland-raw/i.test(e.name)) hits.push(`file name: ${rel(ROOT, full)}`);
                if (e.isDirectory()) scan(full);
                else if (full !== self && fs.statSync(full).size < 5_000_000 && fs.readFileSync(full).toString('latin1').toLowerCase().includes('rob-finland-raw')) hits.push(`text: ${rel(ROOT, full)}`);
            }
        };
        scan(ROOT);
        expect.soft(hits, 'the raw source name "rob-finland-raw"').toEqual([]);
    });
});
