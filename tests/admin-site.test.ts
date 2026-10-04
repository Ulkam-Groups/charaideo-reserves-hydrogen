import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_METAFIELD_DEFINITIONS,
  validateMetafieldValue,
} from '../app/lib/admin-metafields.ts';
import {
  listAdminProducts,
  ShopifyAdminError,
  updateAdminProduct,
} from '../app/lib/shopify-admin.server.ts';
import {applySecurityHeaders} from '../app/lib/security-headers.ts';

test('admin responses cannot be cached, framed, or indexed', () => {
  const response = applySecurityHeaders(
    new Response('admin'),
    new URL('https://example.com/admin/products/1'),
  );
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
});

test('the Postman-derived schema contains 29 unique validated fields', () => {
  assert.equal(ADMIN_METAFIELD_DEFINITIONS.length, 29);
  assert.equal(new Set(ADMIN_METAFIELD_DEFINITIONS.map(({key}) => key)).size, 29);
  assert.equal(
    validateMetafieldValue('number_integer', '6', 'roast'),
    'Must be no more than 5.',
  );
  assert.equal(
    validateMetafieldValue('list.single_line_text_field', '["Assam tea"]', 'ingredients'),
    null,
  );
  assert.equal(
    validateMetafieldValue('json', '{broken', 'recipe_hot'),
    'Enter valid JSON.',
  );
});

test('product listing uses the configured Admin API and preserves pagination/search', async () => {
  let calledUrl = '';
  let request: {query: string; variables: Record<string, unknown>} | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    request = JSON.parse(String(init?.body));
    return Response.json({
      data: {
        products: {
          nodes: [],
          pageInfo: {hasNextPage: false, endCursor: null},
        },
      },
    });
  };
  await listAdminProducts(
    {
      SHOPIFY_ADMIN_STORE_DOMAIN: 'tea.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'server-only-token',
      SHOPIFY_ADMIN_API_VERSION: '2026-07',
    } as Env,
    {after: 'cursor-1', search: 'tag:reserve'},
    fetcher,
  );
  assert.equal(calledUrl, 'https://tea.myshopify.com/admin/api/2026-07/graphql.json');
  assert.match(request!.query, /products\(first: 50/);
  assert.deepEqual(request!.variables, {after: 'cursor-1', query: 'tag:reserve'});
  assert.equal(
    (request as unknown as {variables?: {accessToken?: string}}).variables?.accessToken,
    undefined,
  );
});

test('Shopify mutation user errors are surfaced as validation failures', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      data: {
        productUpdate: {
          product: null,
          userErrors: [
            {field: ['product', 'handle'], message: 'Handle is already in use'},
          ],
        },
      },
    });
  await assert.rejects(
    updateAdminProduct(
      {
        SHOPIFY_ADMIN_STORE_DOMAIN: 'tea.myshopify.com',
        SHOPIFY_ADMIN_ACCESS_TOKEN: 'server-only-token',
      } as Env,
      {
        id: 'gid://shopify/Product/1',
        title: 'Tea',
        handle: 'tea',
        descriptionHtml: '',
        vendor: 'Charaideo Reserves',
        productType: 'Tea',
        status: 'ACTIVE',
        tags: [],
        templateSuffix: '',
        seo: {title: '', description: ''},
      },
      fetcher,
    ),
    (error: unknown) =>
      error instanceof ShopifyAdminError &&
      error.code === 'VALIDATION_FAILED' &&
      /Handle is already in use/.test(error.message),
  );
});
