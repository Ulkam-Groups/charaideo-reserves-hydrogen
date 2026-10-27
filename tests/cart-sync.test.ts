import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublishedCart,
  invalidateCartReconciliation,
  publishCart,
  refreshPublishedCart,
  reconcileCartState,
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

test('cart reconciliation coalesces concurrent drawer and page reads', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      cart: {
        id: 'gid://shopify/Cart/coalesced',
        updatedAt: '2026-10-27T12:00:00.000Z',
        totalQuantity: 2,
      },
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  const drawerRead = reconcileCartState();
  const pageRead = reconcileCartState();

  assert.equal(drawerRead, pageRead);
  assert.equal((await drawerRead)?.totalQuantity, 2);
  assert.equal(requests, 1);
});

test('a new mutation invalidates an older cart reconciliation', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  const responses: Array<(response: Response) => void> = [];
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      responses.push(resolve);
    });

  invalidateCartReconciliation();
  const olderRead = reconcileCartState();
  invalidateCartReconciliation();
  const newerRead = reconcileCartState();

  assert.notEqual(olderRead, newerRead);
  assert.equal(responses.length, 2);

  responses[1](
    Response.json({
      cart: {
        id: 'gid://shopify/Cart/current',
        updatedAt: '2026-10-27T12:00:01.000Z',
        totalQuantity: 3,
      },
      unavailable: false,
    }),
  );
  assert.equal((await newerRead)?.totalQuantity, 3);

  responses[0](
    Response.json({
      cart: {
        id: 'gid://shopify/Cart/stale',
        updatedAt: '2026-10-27T12:00:00.000Z',
        totalQuantity: 2,
      },
      unavailable: false,
    }),
  );
  await olderRead;
});

test('cart reconciliation retries a transient unavailable read', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    if (requests === 1) {
      return Response.json({cart: null, unavailable: true});
    }
    return Response.json({
      cart: {
        id: 'gid://shopify/Cart/retried',
        updatedAt: '2026-10-27T12:00:02.000Z',
        totalQuantity: 4,
      },
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  assert.equal((await reconcileCartState())?.totalQuantity, 4);
  assert.equal(requests, 2);
});

test('background checkout cleanup publishes the cleared server cart', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  const clearedCart = {
    id: 'gid://shopify/Cart/cleared',
    updatedAt: '2026-10-27T12:00:03.000Z',
    totalQuantity: 0,
    lines: {nodes: []},
  };
  globalThis.fetch = async () => Response.json({cart: clearedCart, unavailable: false});

  assert.deepEqual(await refreshPublishedCart(), clearedCart);
  assert.deepEqual(getPublishedCart(), clearedCart);
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
