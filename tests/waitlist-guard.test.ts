import assert from 'node:assert/strict';
import test from 'node:test';
import {readWaitlistRequest} from '../app/lib/waitlist-guard.server.ts';
import {API_RATE_LIMITS, enforceApiRateLimit} from '../app/lib/api-rate-limit.server.ts';

const url = 'https://preview.myshopify.dev/api/waitlist';

function request(
  headers: Record<string, string> = {},
  body = '{"email":"tea@example.com","consent":true}',
) {
  return new Request(url, {
    method: 'POST',
    headers: {
      Origin: new URL(url).origin,
      'Content-Type': 'application/json',
      'oxygen-buyer-ip': '192.0.2.1',
      ...headers,
    },
    body,
  });
}

test('waitlist accepts a small same-origin JSON signup', async () => {
  assert.deepEqual(await readWaitlistRequest(request()), {
    email: 'tea@example.com',
    consent: true,
  });
});

test('waitlist rejects cross-origin requests and oversized bodies', async () => {
  const invalidHeaders: Array<Record<string, string>> = [
    {Origin: 'https://other.example'},
    {Origin: new URL(url).origin, Referer: 'https://other.example/'},
    {'Sec-Fetch-Site': 'cross-site'},
  ];
  for (const headers of invalidHeaders) {
    const result = await readWaitlistRequest(request(headers));
    assert.ok(result instanceof Response);
    assert.equal(result.status, 403);
  }
  const oversized = await readWaitlistRequest(
    request(
      {},
      JSON.stringify({
        email: 'tea@example.com',
        consent: true,
        padding: 'x'.repeat(600),
      }),
    ),
  );
  assert.ok(oversized instanceof Response);
  assert.equal(oversized.status, 413);
});

test('waitlist policy is centralized at 3 per minute and 6 per day', () => {
  assert.deepEqual(API_RATE_LIMITS['/api/waitlist'].limits, [
    {max: 3, windowMs: 60_000},
    {max: 6, windowMs: 86_400_000},
  ]);
});

test('waitlist enforces both windows for one Oxygen buyer IP', async () => {
  const entries = new Map<string, Response>();
  const cache = {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, value: Response) => {
      entries.set(key.url, value.clone());
    },
  } as unknown as Pick<Cache, 'match' | 'put'>;

  for (let index = 0; index < 3; index++) {
    assert.equal(
      await enforceApiRateLimit(request(), cache, '/api/waitlist', 1_000),
      null,
    );
  }
  const minuteBlocked = await enforceApiRateLimit(
    request(),
    cache,
    '/api/waitlist',
    1_000,
  );
  assert.equal(minuteBlocked?.status, 429);
  assert.ok(Number(minuteBlocked?.headers.get('Retry-After')) > 0);

  for (let index = 0; index < 3; index++) {
    assert.equal(
      await enforceApiRateLimit(request(), cache, '/api/waitlist', 61_000),
      null,
    );
  }
  const dayBlocked = await enforceApiRateLimit(
    request(),
    cache,
    '/api/waitlist',
    121_000,
  );
  assert.equal(dayBlocked?.status, 429);
  assert.ok(Number(dayBlocked?.headers.get('Retry-After')) > 60);

  assert.equal(
    await enforceApiRateLimit(
      request({'oxygen-buyer-ip': '192.0.2.2'}),
      cache,
      '/api/waitlist',
      1_000,
    ),
    null,
  );
  assert.equal(
    await enforceApiRateLimit(request(), cache, '/api/waitlist', 86_401_000),
    null,
  );
});

test('rolling minute does not reset at a clock boundary and local cache keys use HTTPS', async () => {
  const entries = new Map<string, Response>();
  const cache = {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, value: Response) => {
      entries.set(key.url, value.clone());
    },
  } as unknown as Pick<Cache, 'match' | 'put'>;
  const localRequest = new Request('http://localhost:3000/api/waitlist', {
    headers: {'oxygen-buyer-ip': '192.0.2.3'},
  });

  for (let index = 0; index < 3; index++) {
    assert.equal(
      await enforceApiRateLimit(localRequest, cache, '/api/waitlist', 30_000),
      null,
    );
  }
  assert.ok([...entries.keys()].every((key) => key.startsWith('https://')));
  assert.equal(
    (await enforceApiRateLimit(localRequest, cache, '/api/waitlist', 60_000))?.status,
    429,
  );
  assert.equal(
    await enforceApiRateLimit(localRequest, cache, '/api/waitlist', 90_000),
    null,
  );
});
