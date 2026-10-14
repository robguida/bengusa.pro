// The About page's files (spec decision 18, acceptance check 26.d), checked on
// the committed files, with no browser:
//   - the two photos in public/images/about/: no metadata of any kind, sRGB,
//     480 x 600, each at most 100 KB;
//   - the public-folder allow-list holds exactly those two paths;
//   - no phone-number shape in the About words or the built About page.
// Nothing here names a real person's employer, client, school, city, phone or
// reference: a banned pattern that named one would itself leak it.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { test, expect } from '@playwright/test';
import { ROOT, OUT_DIR } from '../../scripts/lib/export-checks.mjs';
import { readFixtureList } from '../support/fixtures.mjs';
import { ABOUT } from '../support/words.mjs';
import { PHONE_SHAPES, findPhones } from '../support/content-scan.mjs';

const DIR = path.join(ROOT, 'public', 'images', 'about');
const FILES = ABOUT.people.map((p) => ({ name: p.name, rel: p.photo.replace(/^\//, ''), file: path.join(ROOT, 'public', p.photo.replace(/^\//, '')) }));

// Words that must not be anywhere in the bytes of a photo (the camera's and
// the phone's own marks, location, and the metadata containers).
const BANNED_BYTES = ['Exif', 'GPS', 'xmpmeta', 'Apple', 'iPhone', 'ICCP', 'XMP ', 'EXIF', 'IPTC', 'Photoshop', 'http://ns.adobe.com'];

// The chunks a plain, metadata-free WebP may hold.
const PLAIN_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);

function chunks(buf) {
    expect(buf.toString('latin1', 0, 4), 'RIFF header').toBe('RIFF');
    expect(buf.toString('latin1', 8, 12), 'WEBP header').toBe('WEBP');
    expect(buf.readUInt32LE(4) + 8, 'RIFF length matches the file').toBe(buf.length);
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
    test('public/images/about/ holds exactly the two photos, and the allow-list names exactly those', () => {
        expect(fs.readdirSync(DIR).sort()).toEqual(FILES.map((f) => path.basename(f.file)).sort());
        const allowed = readFixtureList('public-allowlist.txt').filter((p) => p.startsWith('images/about/'));
        expect(allowed.sort()).toEqual(FILES.map((f) => f.rel).sort());
    });

    for (const f of FILES) {
        test(`${f.rel}: no exif, xmp, iptc or icc; sRGB; 480x600; at most 100 KB`, async () => {
            const buf = fs.readFileSync(f.file);
            expect(buf.length, 'size in bytes').toBeLessThanOrEqual(ABOUT.photoFile.maxBytes);
            expect(buf.length).toBeGreaterThan(1000);

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
            const meta = await sharp(buf).metadata();
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

test.describe('phone-number shapes', () => {
    test('the pattern catches the common shapes (made-up numbers only)', () => {
        const caught = [
            '555-010-0199', '(555) 010-0199', '555.010.0199', '+1 555 010 0199', '+44 20 7946 0000', '5550100199', '1-800-555-0100',
        ];
        for (const s of caught) expect(findPhones(`Call ${s} today`).length, s).toBeGreaterThan(0);
        const fine = [
            'more than 30 years', 'since 2015', '240 x 300', 'Node.js 24', 'in 2026-10-15', 'AWS, SQL, Node.js, GraphQL', '480x600',
        ];
        for (const s of fine) expect(findPhones(s), s).toEqual([]);
        expect(PHONE_SHAPES.length).toBeGreaterThan(0);
    });

    test('the About words and the built About page hold none', () => {
        const words = fs.readFileSync(path.join(ROOT, 'content', 'about-words.json'), 'utf8');
        expect(findPhones(words), 'content/about-words.json').toEqual([]);
        const html = fs.readFileSync(path.join(OUT_DIR, 'about', 'index.html'), 'utf8');
        // Visible text and attributes only: no scripts or styles (they hold long digit runs).
        const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
        expect(findPhones(visible), 'out/about/index.html (text)').toEqual([]);
        const alts = [...html.matchAll(/\balt="([^"]*)"/g)].map((m) => m[1]).join('\n');
        expect(findPhones(alts), 'out/about/index.html (alt text)').toEqual([]);
    });
});
