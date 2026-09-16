import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearJudgeMeReviewCacheForTests,
  getJudgeMeProductReviews,
} from '../app/lib/judgeme.server.ts';

test('Judge.me reviews coalesce and cache requests for a product', async () => {
  clearJudgeMeReviewCacheForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const cacheEntries = new Map<string, Response>();
  const cache = {
    match: async (request: Request) => cacheEntries.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      cacheEntries.set(request.url, response.clone());
    },
  };
  globalThis.fetch = (async (input) => {
    calls += 1;
    const url = new URL(String(input));
    if (url.pathname.endsWith('/products/-1')) {
      return Response.json({product: {id: 42}});
    }
    return Response.json({reviews: [{id: 1, rating: 5, body: 'Excellent'}]});
  }) as typeof fetch;

  try {
    const options = {
      cache,
      shopDomain: 'store.myshopify.com',
      privateApiToken: 'private-token',
      shopifyProductGid: 'gid://shopify/Product/123',
    };
    const [first, concurrent] = await Promise.all([
      getJudgeMeProductReviews(options),
      getJudgeMeProductReviews(options),
    ]);
    clearJudgeMeReviewCacheForTests();
    const cached = await getJudgeMeProductReviews(options);

    assert.equal(first.reviews.length, 1);
    assert.deepEqual(concurrent, first);
    assert.deepEqual(cached, first);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearJudgeMeReviewCacheForTests();
  }
});

test('Judge.me fallback performs at most one review-page request', async () => {
  clearJudgeMeReviewCacheForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input) => {
    calls += 1;
    const url = new URL(String(input));
    if (url.pathname.endsWith('/products/-1')) return Response.json({product: {}});
    return Response.json({reviews: []});
  }) as typeof fetch;

  try {
    await getJudgeMeProductReviews({
      shopDomain: 'store.myshopify.com',
      privateApiToken: 'private-token',
      shopifyProductGid: 'gid://shopify/Product/999',
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearJudgeMeReviewCacheForTests();
  }
});
