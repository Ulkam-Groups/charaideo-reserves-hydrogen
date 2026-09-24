import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const port = 4197;
const origin = `http://127.0.0.1:${port}`;
const fixturePath = fileURLToPath(
  new URL('./e2e/storefront-api-mock.mjs', import.meta.url),
);

async function graphql(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(`${origin}/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}),
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<{data: Record<string, any>}>;
}

test('local Storefront fixture supports the complete checkout E2E data path', async (t) => {
  const fixture = spawn(process.execPath, [fixturePath], {
    env: {...process.env, E2E_STOREFRONT_PORT: String(port)},
    stdio: 'ignore',
  });
  t.after(() => fixture.kill());

  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) break;
    } catch {
      if (attempt === 39) throw new Error('Storefront fixture did not start');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  const catalog = await graphql(
    'query Catalog { products(first: 8) { nodes { id handle } } }',
  );
  const product = catalog.data.products.nodes[0];
  assert.equal(product.handle, 'e2e-assam-tea');

  const detail = await graphql(
    'query Product($handle: String!) { product(handle: $handle) { id } }',
    {handle: product.handle},
  );
  assert.equal(detail.data.product.id, product.id);

  const created = await graphql(
    'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id } } }',
    {
      input: {
        lines: [{merchandiseId: 'gid://shopify/ProductVariant/2001', quantity: 1}],
      },
    },
  );
  const cart = created.data.cartCreate.cart;
  assert.equal(cart.totalQuantity, 1);
  assert.match(cart.lines.nodes[0].merchandise.id, /ProductVariant\/2001$/);

  const persisted = await graphql(
    'query CartQuery($cartId: ID!) { cart(id: $cartId) { id } }',
    {cartId: cart.id},
  );
  assert.equal(persisted.data.cart.id, cart.id);

  const updated = await graphql(
    'mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } } }',
    {
      cartId: cart.id,
      lines: [{id: cart.lines.nodes[0].id, quantity: 2}],
    },
  );
  assert.equal(updated.data.cartLinesUpdate.cart.totalQuantity, 2);
  assert.equal(updated.data.cartLinesUpdate.cart.lines.nodes[0].quantity, 2);
});
