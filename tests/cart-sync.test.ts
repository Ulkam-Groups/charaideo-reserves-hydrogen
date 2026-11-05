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
        lines: {nodes: [{id: 'line-1', quantity: 2}]},
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
        lines: {nodes: [{id: 'line-1', quantity: 3}]},
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
        lines: {nodes: [{id: 'line-1', quantity: 2}]},
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
        lines: {nodes: [{id: 'line-1', quantity: 4}]},
      },
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  assert.equal((await reconcileCartState())?.totalQuantity, 4);
  assert.equal(requests, 2);
});

test('first-cart reconciliation retries while its cookie resolves to no cart', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  const completeCart = {
    id: 'gid://shopify/Cart/fresh-session',
    updatedAt: '2026-10-27T12:00:02.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      cart: requests === 1 ? null : completeCart,
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  assert.deepEqual(await reconcileCartState(), completeCart);
  assert.equal(requests, 2);
});

test('cart reconciliation retries when the total arrives before its lines', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  const completeCart = {
    id: 'gid://shopify/Cart/first-item',
    updatedAt: '2026-10-27T12:00:02.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      cart: requests === 1 ? {...completeCart, lines: {nodes: []}} : completeCart,
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  assert.deepEqual(await reconcileCartState(), completeCart);
  assert.equal(requests, 2);
});

test('first-cart reconciliation survives a longer line propagation delay', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateCartReconciliation();
  });

  const completeCart = {
    id: 'gid://shopify/Cart/slow-first-item',
    updatedAt: '2026-10-27T12:00:03.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      cart: requests < 4 ? {...completeCart, lines: {nodes: []}} : completeCart,
      unavailable: false,
    });
  };
  invalidateCartReconciliation();

  assert.deepEqual(await reconcileCartState(), completeCart);
  assert.equal(requests, 4);
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

test('an equal-timestamp empty loader cart cannot erase the first item', () => {
  const firstItemCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  const staleEmptyCart = {
    id: firstItemCart.id,
    updatedAt: firstItemCart.updatedAt,
    totalQuantity: 0,
    lines: {nodes: []},
  };

  assert.equal(
    selectAuthoritativeCart(firstItemCart as never, staleEmptyCart as never),
    firstItemCart,
  );
});

test('an equal-timestamp first-item mutation replaces the original empty cart', () => {
  const timestamp = '2026-10-12T12:00:00.000Z';
  const originalEmptyCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: timestamp,
    totalQuantity: 0,
    lines: {nodes: []},
  };
  const firstItemCart = {
    ...originalEmptyCart,
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };

  assert.equal(
    selectAuthoritativeCart(originalEmptyCart as never, firstItemCart as never),
    firstItemCart,
  );
});

test('repeated equal-timestamp empty reads cannot roll back a confirmed first item', () => {
  const firstItemCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  const staleEmptyReads = Array.from({length: 10}, () => ({
    id: firstItemCart.id,
    updatedAt: firstItemCart.updatedAt,
    totalQuantity: 0,
    lines: {nodes: []},
  }));

  const selected = staleEmptyReads.reduce(
    (cart, candidate) =>
      selectAuthoritativeCart(cart as never, candidate as never) as typeof firstItemCart,
    firstItemCart,
  );

  assert.equal(selected, firstItemCart);
  assert.equal(selected.totalQuantity, 1);
});

test('a newer empty cart still clears the confirmed last item', () => {
  const firstItemCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  const clearedCart = {
    id: firstItemCart.id,
    updatedAt: '2026-10-12T12:00:00.001Z',
    totalQuantity: 0,
    lines: {nodes: []},
  };

  assert.equal(
    selectAuthoritativeCart(firstItemCart as never, clearedCart as never),
    clearedCart,
  );
});

test('a partial cart read cannot overwrite a complete mutation cart', () => {
  const completeCart = {
    id: 'gid://shopify/Cart/test',
    updatedAt: '2026-10-12T12:00:00.000Z',
    totalQuantity: 1,
    lines: {nodes: [{id: 'line-1', quantity: 1}]},
  };
  const partialCart = {
    ...completeCart,
    updatedAt: '2026-10-12T12:00:01.000Z',
    lines: {nodes: []},
  };

  assert.equal(
    selectAuthoritativeCart(completeCart as never, partialCart as never),
    completeCart,
  );
});
