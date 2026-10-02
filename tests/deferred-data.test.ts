import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {settleDeferred} from '../app/lib/deferred.server.ts';

test('deferred data returns its value when it resolves in time', async () => {
  assert.equal(await settleDeferred(Promise.resolve('ready'), 'fallback', 50), 'ready');
});

test('deferred data falls back on rejection', async () => {
  assert.equal(
    await settleDeferred(Promise.reject(new Error('upstream failed')), 'fallback', 50),
    'fallback',
  );
});

test('deferred data falls back before a hanging integration can hit the router deadline', async () => {
  const startedAt = Date.now();
  const hanging = new Promise<string>(() => {});

  assert.equal(await settleDeferred(hanging, 'fallback', 20), 'fallback');
  assert.ok(Date.now() - startedAt < 250);
});

test('Judge.me is isolated from the PDP loader and Shopify recommendations contain errors locally', () => {
  const productRoute = readFileSync('app/routes/products.$handle.tsx', 'utf8');
  const asyncReviews = readFileSync('app/components/AsyncProductReviews.tsx', 'utf8');

  assert.doesNotMatch(productRoute, /getJudgeMeProductReviews/);
  assert.doesNotMatch(productRoute, /judgeMeReviews:/);
  assert.match(productRoute, /<AsyncProductReviews/);
  assert.match(asyncReviews, /fetch\(\s*`\/api\/product-reviews/);
  assert.match(asyncReviews, /controller\.abort\(\)/);
  assert.match(productRoute, /resolve=\{relatedProducts\} errorElement=\{null\}/);
});
