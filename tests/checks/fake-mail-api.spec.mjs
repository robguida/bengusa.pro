// Keeps the mail fake (tests/fakes/fake-mail-api.mjs) working until
// BUWEB-107 starts using it.
import { test, expect } from '@playwright/test';
import { startFakeMailApi } from '../fakes/fake-mail-api.mjs';

test('the fake mail API records requests, hides secrets and can fail on demand', async ({ request }) => {
    const fake = await startFakeMailApi();
    try {
        expect(fake.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
        const ok = await request.post(`${fake.url}/v1/subscribers?list=test`, {
            headers: { authorization: 'Token not-a-real-key', 'x-api-key': 'not-a-real-key' },
            data: { email_address: 'test-person@example.test', tags: ['catche'] },
        });
        expect(ok.status()).toBe(200);
        expect((await ok.json()).id).toBe('fake-1');

        fake.failNext(503);
        expect((await request.post(`${fake.url}/v2/email/outbound-emails`, { data: { to: 'test@example.test' } })).status()).toBe(503);

        const [first, second] = fake.requests();
        expect(first).toMatchObject({ method: 'POST', path: '/v1/subscribers', query: { list: 'test' } });
        expect(first.json).toEqual({ email_address: 'test-person@example.test', tags: ['catche'] });
        expect(first.headers.authorization).toBe('[redacted]');
        expect(first.headers['x-api-key']).toBe('[redacted]');
        expect(JSON.stringify(fake.requests())).not.toContain('not-a-real-key');
        expect(second.path).toBe('/v2/email/outbound-emails');

        fake.clear();
        expect(fake.requests()).toEqual([]);
    } finally {
        await fake.close();
    }
});
