// Reads a list file from tests/fixtures/: one entry per line, # = comment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function readFixtureList(name) {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
        .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}
