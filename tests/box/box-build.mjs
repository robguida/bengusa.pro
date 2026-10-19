// The box run's address and the build it is looking at (see box.config.mjs).
import { BUILD_ID_RE } from '../../scripts/release/lib.mjs';

// E2E_BASE_URL as a plain origin (scheme and host, no slash at the end), or ''
// when it is not set. A leftover STATIC-IP or a path fails at once, before
// any browser starts.
export function boxBaseURL(raw = process.env.E2E_BASE_URL) {
    const value = (raw || '').trim();
    if (!value) return '';
    if (/STATIC-IP/i.test(value)) throw new Error('E2E_BASE_URL still says STATIC-IP: put the box\'s static IP in its place.');
    const origin = value.replace(/\/+$/, '');
    if (!/^https?:\/\/[^/\s?#]+$/.test(origin)) {
        throw new Error(`E2E_BASE_URL must be the box's address only, like http://203.0.113.10/ (it is "${value}").`);
    }
    return origin;
}

// Reads <base>/version.txt (the release bundle's own file) and returns
// { build, commit }. Throws, naming what is wrong, when the file is missing or
// has no valid build= line.
export async function readBoxBuild(base) {
    const url = `${base}/version.txt`;
    let res;
    try {
        res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    } catch (err) {
        throw new Error(`could not read ${url}: ${err.cause?.message || err.message}`);
    }
    if (res.status !== 200) throw new Error(`${url} answered ${res.status}, not 200`);
    const lines = Object.fromEntries((await res.text()).split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    if (!BUILD_ID_RE.test(lines.build || '')) throw new Error(`${url} has no valid build= line (got "${lines.build ?? ''}")`);
    return { build: lines.build, commit: lines.commit || '' };
}
