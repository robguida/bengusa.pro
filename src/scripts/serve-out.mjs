// `npm start`: serves the static build in out/ on this PC only (127.0.0.1).
// It replaces `next start`, which does not work with output: 'export'.
// For local checks and the test suite only; the live site uses its own web server.
//
//   node scripts/serve-out.mjs [--port 3000] [--dir out]
//
// Behaves like a plain static host: /about/ serves about/index.html, /about
// redirects to /about/, a missing file is a real 404 (with 404.html as the
// body), and there is no fallback to index.html. No packages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dir = path.resolve(ROOT, arg('dir', 'out'));
const port = Number(arg('port', process.env.PORT || 3000));

if (!fs.existsSync(path.join(dir, 'index.html'))) {
    console.error(`No static build found at ${dir}. Run "npm run build" first.`);
    process.exit(1);
}

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
};

function isFile(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Returns { file } to serve, { redirect } for a folder asked for without its
// slash, or {} for a 404.
function resolve(urlPath) {
    let decoded;
    try { decoded = decodeURIComponent(urlPath); } catch { return {}; }
    const full = path.resolve(dir, `.${decoded}`);
    if (full !== dir && !full.startsWith(dir + path.sep)) return {}; // no path traversal
    if (decoded.endsWith('/')) {
        const index = path.join(full, 'index.html');
        return isFile(index) ? { file: index } : {};
    }
    if (isFile(full)) return { file: full };
    if (isFile(path.join(full, 'index.html'))) return { redirect: `${urlPath}/` };
    return {};
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' });
        return res.end();
    }
    const [urlPath, query] = req.url.split('?');
    const found = resolve(urlPath);
    if (found.redirect) {
        res.writeHead(301, { location: found.redirect + (query ? `?${query}` : '') });
        return res.end();
    }
    if (!found.file) {
        const notFound = path.join(dir, '404.html');
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        return res.end(req.method === 'HEAD' ? undefined : (isFile(notFound) ? fs.readFileSync(notFound) : 'Not found'));
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(found.file).toLowerCase()] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(found.file).pipe(res);
});

server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : err.message);
    process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Serving ${path.relative(ROOT, dir) || '.'}/ at http://127.0.0.1:${server.address().port}/ (Ctrl+C to stop)`);
});
