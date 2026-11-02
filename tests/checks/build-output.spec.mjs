// Checks on the build itself: the route table and the files in out/.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
    BUILD_LOG, OUT_DIR, ROOT, checkGuardedFields, checkRouteTable, expectedRoutes, rel, walk,
} from '../../scripts/lib/export-checks.mjs';
import { scanOut } from '../support/content-scan.mjs';
import { readFixtureList } from '../support/fixtures.mjs';

test.describe('build output', () => {
    test('every route in the build is static (○ or ●), and every page is there', () => {
        expect(fs.existsSync(BUILD_LOG), `no build log at ${BUILD_LOG}: run "npm run build" first`).toBe(true);
        const result = checkRouteTable(fs.readFileSync(BUILD_LOG, 'utf8'));
        expect(result.problems).toEqual([]);
        const built = result.rows.filter((r) => r.sym).map((r) => r.route);
        for (const route of expectedRoutes()) expect(built).toContain(route);
    });

    test('no list-only field or retired app ID reaches out/ (§6.1 item 11)', () => {
        const result = checkGuardedFields(OUT_DIR);
        expect(result.scanned).toBeGreaterThan(10);
        expect(result.hits).toEqual([]);
    });

    test.describe('banned content in out/ (text files)', () => {
        let scan;
        test.beforeAll(() => { scan = scanOut(OUT_DIR); });
        const cases = {
            outsideUrl: 'no outside web addresses',
            protocolRelative: 'no protocol-relative (//host) links',
            googleFonts: 'no Google font hosts (binary files too)',
            llc: 'no "LLC"',
            email: 'no email addresses',
            oldSite: 'no old-site content (Digital Silk, client logos, maintenance switch)',
            retiredVault: 'no retired Vault lines ("doesn\'t wear the Off-grid badge", the old sync card note), on any page or in any file',
        };
        for (const [key, title] of Object.entries(cases)) {
            test(title, () => {
                expect(scan.textCount).toBeGreaterThan(10);
                expect(scan.hits[key]).toEqual([]);
            });
        }
    });

    test('public/ holds only the allow-listed files, and each one ships unchanged', () => {
        const allowed = readFixtureList('public-allowlist.txt').sort();
        const publicDir = path.join(ROOT, 'public');
        const actual = walk(publicDir).map((f) => rel(publicDir, f)).sort();
        expect(actual).toEqual(allowed);
        for (const file of allowed) {
            const shipped = path.join(OUT_DIR, file);
            expect(fs.existsSync(shipped), `${file} missing from out/`).toBe(true);
            expect(fs.readFileSync(shipped).equals(fs.readFileSync(path.join(publicDir, file))), `${file} differs in out/`).toBe(true);
        }
    });
});
