import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

import {buildAnalyticsConsent} from '../app/lib/analytics.ts';
import {sanitizeStorefrontHtml} from '../app/lib/html.server.ts';
import {applySecurityHeaders} from '../app/lib/security-headers.ts';
import {
  parseCartPermalink,
  normalizePredictiveSearch,
} from '../app/lib/storefront-input.ts';

test('analytics consent uses the Shopify checkout domain and public token', () => {
  assert.deepEqual(
    buildAnalyticsConsent({
      PUBLIC_CHECKOUT_DOMAIN: 'checkout.example.com',
      PUBLIC_STOREFRONT_API_TOKEN: 'public-token',
    }),
    {
      checkoutDomain: 'checkout.example.com',
      storefrontAccessToken: 'public-token',
      withPrivacyBanner: true,
    },
  );
});

test('cart permalink accepts valid Shopify variant lines and discount codes', () => {
  assert.deepEqual(parseCartPermalink('12345:2,67890:1', 'WELCOME-10'), {
    lines: [
      {merchandiseId: 'gid://shopify/ProductVariant/12345', quantity: 2},
      {merchandiseId: 'gid://shopify/ProductVariant/67890', quantity: 1},
    ],
    discountCodes: ['WELCOME-10'],
  });
});

test('cart permalink rejects malformed, excessive, or dangerous input', () => {
  for (const value of [
    'abc:1',
    '123:0',
    '123:-1',
    '123:101',
    '123:1:2',
    Array.from({length: 26}, (_, index) => `${index + 1}:1`).join(','),
  ]) {
    assert.throws(() => parseCartPermalink(value, null));
  }
  assert.throws(() => parseCartPermalink('123:1', 'bad code!'));
});

test('predictive search trims the term and clamps the result count', () => {
  assert.deepEqual(normalizePredictiveSearch('  assam tea  ', '999'), {
    term: 'assam tea',
    limit: 20,
  });
  assert.deepEqual(normalizePredictiveSearch('tea', 'not-a-number'), {
    term: 'tea',
    limit: 10,
  });
  assert.equal(normalizePredictiveSearch('x'.repeat(101), '10').term.length, 100);
});

test('storefront HTML keeps useful formatting but removes active content', () => {
  const html = sanitizeStorefrontHtml(
    '<p onclick="steal()">Tea <strong>notes</strong></p>' +
      '<script>alert(1)</script>' +
      '<a href="javascript:alert(1)" target="_blank">bad</a>' +
      '<a href="https://example.com" target="_blank">safe</a>',
  );

  assert.match(html, /<p>Tea <strong>notes<\/strong><\/p>/);
  assert.doesNotMatch(html, /onclick|script|javascript:/i);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('global security headers are applied without weakening CSP', () => {
  const response = new Response('ok', {
    headers: {'Content-Security-Policy': "default-src 'self'"},
  });
  applySecurityHeaders(response, new URL('https://store.example/products/tea'));

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  assert.match(response.headers.get('strict-transport-security') ?? '', /max-age=/);
  assert.equal(response.headers.get('content-security-policy'), "default-src 'self'");
});

test('Admin API scopes remain empty for the customer storefront', async () => {
  const config = await readFile(new URL('../shopify.app.toml', import.meta.url), 'utf8');
  assert.match(config, /^scopes\s*=\s*""$/m);
  assert.doesNotMatch(config, /write_(products|orders|customers|inventory|draft_orders)/);
});

test('protected account routes use the awaited auth guard', async () => {
  for (const route of [
    'account.profile.tsx',
    'account.addresses.tsx',
    'account.$.tsx',
  ]) {
    const source = await readFile(
      new URL(`../app/routes/${route}`, import.meta.url),
      'utf8',
    );
    assert.match(source, /await requireCustomerAuthStatus\(context\.customerAccount\)/);
  }
});

test('root mounts the analytics provider around the storefront layout', async () => {
  const source = await readFile(new URL('../app/root.tsx', import.meta.url), 'utf8');
  assert.match(source, /<Analytics\.Provider/);
  assert.match(source, /shop=\{data\.shop\}/);
  assert.match(source, /consent=\{data\.consent\}/);
});

test('manual Storefront API proxy is removed in favor of Hydrogen handler', async () => {
  await assert.rejects(
    access(new URL('../app/routes/api.$version.[graphql.json].tsx', import.meta.url)),
  );
});
