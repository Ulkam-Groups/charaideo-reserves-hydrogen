import assert from 'node:assert/strict';
import test from 'node:test';

import {readProtectedForm} from '../app/lib/protected-write.server.ts';

const url = 'https://store.example/account/profile';
const options = {methods: ['POST'], maxBytes: 32};

function request(body = 'firstName=Test', headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      Origin: 'https://store.example',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
  });
}

test('accepts same-origin form posts and keeps duplicate form fields', async () => {
  const result = await readProtectedForm(request('code=a&code=b'), options);
  assert.ok(result instanceof FormData);
  assert.deepEqual(result.getAll('code'), ['a', 'b']);
});

test('requires an exact origin or same-origin referer and rejects conflicting headers', async () => {
  const cases: Array<Record<string, string>> = [
    {Origin: 'https://other.store.example'},
    {Origin: 'https://store.example.evil.test'},
    {Origin: 'null'},
    {Origin: 'http://store.example'},
    {Origin: 'https://store.example', Referer: 'https://evil.test/'},
    {Origin: '', Referer: ''},
    {Origin: 'https://store.example', 'Sec-Fetch-Site': 'same-site'},
    {Origin: 'https://store.example', 'Sec-Fetch-Site': 'cross-site'},
  ];
  for (const headers of cases) {
    const result = await readProtectedForm(request('a=b', headers), options);
    assert.ok(result instanceof Response);
    assert.equal(result.status, 403);
  }
  const fallbackRequest = request('a=b', {Referer: `${url}?page=1`});
  fallbackRequest.headers.delete('Origin');
  const fallback = await readProtectedForm(fallbackRequest, options);
  assert.ok(fallback instanceof FormData);
});

test('rejects unsupported content types, methods, and malformed lengths', async () => {
  for (const contentType of ['text/plain', 'application/json', 'multipart/form-data']) {
    const result = await readProtectedForm(
      request('a=b', {'Content-Type': contentType}),
      options,
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 415);
  }
  const length = await readProtectedForm(
    request('a=b', {'Content-Length': 'invalid'}),
    options,
  );
  assert.ok(length instanceof Response);
  assert.equal(length.status, 400);
  const method = await readProtectedForm(request(), {methods: ['DELETE'], maxBytes: 32});
  assert.ok(method instanceof Response);
  assert.equal(method.status, 405);
});

test('enforces the body limit with and without a declared length', async () => {
  const declared = await readProtectedForm(
    request('a=b', {'Content-Length': '33'}),
    options,
  );
  assert.ok(declared instanceof Response);
  assert.equal(declared.status, 413);
  const streamed = await readProtectedForm(request(`a=${'x'.repeat(40)}`), options);
  assert.ok(streamed instanceof Response);
  assert.equal(streamed.status, 413);
  const boundary = await readProtectedForm(request(`a=${'x'.repeat(30)}`), options);
  assert.ok(boundary instanceof FormData);
});
