import assert from 'node:assert/strict';
import test from 'node:test';
import {loader} from '../app/routes/agent.buyer-claims.ts';

const request = new Request(
  'https://preview.myshopify.dev/agent/buyer-claims?desktop=1',
  {
    headers: {
      Cookie: 'hydrogen_session=private',
      Authorization: 'Bearer private',
      'User-Agent': 'Test Browser',
      Referer: 'https://preview.myshopify.dev/',
    },
  },
);
const context = {env: {PUBLIC_STORE_DOMAIN: 'f5a7fq-re.myshopify.com'}};

test('buyer claims route proxies only the configured Shopify store', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl: URL | undefined;
  let forwardedHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = new URL(String(input));
    forwardedHeaders = new Headers(init?.headers);
    return new Response('claims', {
      headers: {'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=600'},
    });
  };

  try {
    const response = await loader({request, context} as any);
    assert.equal(
      requestedUrl?.href,
      'https://f5a7fq-re.myshopify.com/agent/buyer-claims?desktop=1',
    );
    assert.equal(
      forwardedHeaders?.get('Sec-Shopify-Storefront-Origin'),
      'https://preview.myshopify.dev',
    );
    assert.equal(forwardedHeaders?.has('Cookie'), false);
    assert.equal(forwardedHeaders?.has('Authorization'), false);
    assert.equal(forwardedHeaders?.get('User-Agent'), 'Test Browser');
    assert.equal(forwardedHeaders?.get('Referer'), 'https://preview.myshopify.dev/');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(await response.text(), 'claims');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buyer claims route does not frame the Online Store password page', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, {
      status: 302,
      headers: {Location: 'https://f5a7fq-re.myshopify.com/password'},
    });

  try {
    const response = await loader({request, context} as any);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buyer claims route does not frame an unsupported storefront origin', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, {status: 404, headers: {'X-Frame-Options': 'DENY'}});

  try {
    const response = await loader({request, context} as any);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.has('X-Frame-Options'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buyer claims route rejects an invalid upstream domain', async () => {
  const response = await loader({
    request,
    context: {env: {PUBLIC_STORE_DOMAIN: 'example.com'}},
  } as any);
  assert.equal(response.status, 503);
});
