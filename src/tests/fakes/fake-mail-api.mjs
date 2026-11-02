// A fake mail / list provider for tests (ready for BUWEB-107, 108 and 110).
// Point the code under test at this server's URL instead of the real
// provider's API. It records every request in memory and answers 200 with a
// fake id. Nothing is ever sent anywhere: it listens on 127.0.0.1 only and
// makes no outgoing connections.
//
//   const fake = await startFakeMailApi();     // port 0 = any free port
//   ...code under test calls fake.url + '/v1/...'
//   fake.requests()   -> [{ method, path, query, headers, body, json }]
//   fake.failNext(503) -> the next request gets a 503 (to test error paths)
//   fake.clear(); await fake.close();
//
// Secrets never reach the record: authorization, cookie and *-key / *-token
// headers are stored as "[redacted]".
import http from 'node:http';

const SECRET_HEADER = /^(authorization|cookie|proxy-authorization|x-api-key|.*-key|.*-token|.*-secret)$/i;

export function startFakeMailApi({ port = 0 } = {}) {
    const recorded = [];
    const failures = [];
    let counter = 0;

    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const headers = Object.fromEntries(Object.entries(req.headers)
                .map(([k, v]) => [k, SECRET_HEADER.test(k) ? '[redacted]' : v]));
            let json = null;
            try { json = body ? JSON.parse(body) : null; } catch { /* not JSON: keep the raw body */ }
            recorded.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers, body, json });

            const status = failures.shift();
            if (status) {
                res.writeHead(status, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ error: 'fake failure' }));
            }
            counter += 1;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ id: `fake-${counter}` }));
        });
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            resolve({
                url: `http://127.0.0.1:${server.address().port}`,
                requests: () => recorded.map((r) => ({ ...r })),
                failNext: (status = 500) => { failures.push(status); },
                clear: () => { recorded.length = 0; failures.length = 0; },
                close: () => new Promise((done) => server.close(() => done())),
            });
        });
    });
}
