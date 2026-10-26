import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublishedCart,
  publishCart,
  selectAuthoritativeCart,
  subscribeToCart,
} from '../app/lib/cart-sync.ts';

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

test('stale loader carts cannot overwrite empty-boundary mutations', () => {
  const staleEmptyCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T11:59:59.000Z',
    totalQuantity: 0,
  };
  const firstItemCart = {
    ...staleEmptyCart,
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
  };
  const lastItemRemovedCart = {
    ...staleEmptyCart,
    updatedAt: '2026-10-12T12:00:01.000Z',
  };

  assert.equal(
    selectAuthoritativeCart(firstItemCart as never, staleEmptyCart as never),
    firstItemCart,
  );
  assert.equal(
    selectAuthoritativeCart(firstItemCart as never, lastItemRemovedCart as never),
    lastItemRemovedCart,
  );
});
