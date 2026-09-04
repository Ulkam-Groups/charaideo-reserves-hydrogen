import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultBlendRules,
  inventoryChanges,
  priceBlend,
  validateBlend,
  type TeaIngredient,
} from '../app/lib/blend.ts';

const makeTea = (overrides: Partial<TeaIngredient> = {}): TeaIngredient => ({
  variantId: overrides.variantId ?? 'gid://shopify/ProductVariant/1',
  title: overrides.title ?? 'Assam T-1',
  grams: overrides.grams ?? 25,
  pricePerGram: overrides.pricePerGram ?? 1.5,
  maxContributionGrams: overrides.maxContributionGrams ?? 100,
  eligible: overrides.eligible ?? true,
});

test('validateBlend accepts a legal custom blend and tracks totals', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', title: 'Hapjan', grams: 60, pricePerGram: 1.2}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', title: 'Makolbari', grams: 45, pricePerGram: 1.4}),
  ];

  const result = validateBlend(items, defaultBlendRules);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalGrams, 105);
});

test('validateBlend rejects invalid blends for duplicates, spacing, and caps', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', title: 'Hapjan', grams: 45, maxContributionGrams: 40}),
    makeTea({variantId: 'gid://shopify/ProductVariant/1', title: 'Hapjan Duplicate', grams: 25, maxContributionGrams: 40}),
    makeTea({variantId: 'gid://shopify/ProductVariant/3', title: 'Muga', grams: 13, eligible: false, maxContributionGrams: 50}),
  ];

  const result = validateBlend(items, defaultBlendRules);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Each tea can be added only once')));
  assert.ok(result.errors.some((error) => error.includes('not available for blending')));
  assert.ok(result.errors.some((error) => error.includes('increments')));
  assert.ok(result.errors.some((error) => error.includes('limited to 40g')));
});

test('validateBlend rejects blends that fall under the minimum total weight', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/4', title: 'Tinsukia', grams: 20}),
    makeTea({variantId: 'gid://shopify/ProductVariant/5', title: 'Sivasagar', grams: 20}),
  ];

  const result = validateBlend(items, defaultBlendRules);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('at least 50g')));
});

test('priceBlend includes ingredient cost and packaging charge', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', grams: 50, pricePerGram: 1.25}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', grams: 30, pricePerGram: 1.75}),
  ];

  const total = priceBlend(items, {...defaultBlendRules, packagingPrice: 18.5});

  assert.equal(total, 50 * 1.25 + 30 * 1.75 + 18.5);
});

test('inventoryChanges reduces item inventory by exact grams after order creation', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', grams: 65}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', grams: 40}),
  ];

  const deltas = inventoryChanges(items);

  assert.deepEqual(deltas, [
    {variantId: 'gid://shopify/ProductVariant/1', delta: -65},
    {variantId: 'gid://shopify/ProductVariant/2', delta: -40},
  ]);
});
