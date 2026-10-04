import assert from 'node:assert/strict';
import test from 'node:test';

import {action as clearCart} from '../app/routes/cart.clear[.js].ts';
import {action as authenticateOrder} from '../app/routes/$shopId.orders.$orderToken.authenticate.ts';

test('Fastrr cart-clear compatibility route empties the Hydrogen cart', async () => {
  let removedLineIds: string[] | undefined;
  const response = await clearCart({
    request: new Request('https://store.example/cart/clear.js', {method: 'POST'}),
    context: {
      cart: {
        get: async () => ({lines: {nodes: [{id: 'line-1'}, {id: 'line-2'}]}}),
        removeLines: async (lineIds: string[]) => {
          removedLineIds = lineIds;
        },
      },
    },
  } as never);

  assert.equal(response.status, 200);
  assert.deepEqual(removedLineIds, ['line-1', 'line-2']);
  assert.deepEqual(await response.json(), {
    item_count: 0,
    items: [],
    total_price: 0,
  });
});

test('Fastrr order authentication POST is forwarded to the Shopify host', async () => {
  const response = await authenticateOrder({
    request: new Request(
      'https://store.example/65161199713/orders/b256596bd2e9310fd7f37495202e0c3d/authenticate?phone=%2B919002048910&order_number=1039',
      {method: 'POST', body: new URLSearchParams({phone: '+919002048910'})},
    ),
    params: {
      shopId: '65161199713',
      orderToken: 'b256596bd2e9310fd7f37495202e0c3d',
    },
    context: {
      env: {PUBLIC_STORE_DOMAIN: 'charaideoreserves.myshopify.com'},
    },
  } as never);

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get('location'),
    'https://charaideoreserves.myshopify.com/65161199713/orders/b256596bd2e9310fd7f37495202e0c3d/authenticate?phone=%2B919002048910&order_number=1039',
  );
});

test('Fastrr order authentication rejects a non-Shopify redirect domain', async () => {
  const response = await authenticateOrder({
    request: new Request(
      'https://store.example/65161199713/orders/b256596bd2e9310fd7f37495202e0c3d/authenticate',
      {method: 'POST'},
    ),
    params: {
      shopId: '65161199713',
      orderToken: 'b256596bd2e9310fd7f37495202e0c3d',
    },
    context: {env: {PUBLIC_STORE_DOMAIN: 'attacker.example'}},
  } as never);

  assert.equal(response.status, 400);
});
