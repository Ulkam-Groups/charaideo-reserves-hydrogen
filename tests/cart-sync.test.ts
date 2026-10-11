import assert from 'node:assert/strict';
import test from 'node:test';

import {getPublishedCart, publishCart, subscribeToCart} from '../app/lib/cart-sync.ts';

test('successful cart mutations publish their authoritative cart', () => {
  let notifications = 0;
  const unsubscribe = subscribeToCart(() => {
    notifications += 1;
  });
  const cart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
  };

  publishCart(cart as never);

  assert.equal(getPublishedCart(), cart);
  assert.equal(notifications, 1);
  unsubscribe();
});
