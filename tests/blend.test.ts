import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBoxSubtotalCents,
  calculateIngredientPriceCents,
  calculateTotalGrams,
  defaultBlendRules,
  inventoryChanges,
  priceBlend,
  validateIncrement,
  validateBlend,
  type TeaIngredient,
} from '../app/lib/blend.ts';

const makeTea = (overrides: Partial<TeaIngredient> = {}): TeaIngredient => ({
  variantId: overrides.variantId ?? 'gid://shopify/ProductVariant/1',
  title: overrides.title ?? 'Assam T-1',
  grams: overrides.grams ?? 25,
  pricePerGram: overrides.pricePerGram ?? 1.5,
  maxContributionGrams: overrides.maxContributionGrams ?? 100,
  availableForSale: overrides.availableForSale,
  quantityAvailable: overrides.quantityAvailable,
  eligible: overrides.eligible ?? true,
});

test('validateIncrement accepts 5g and 10g, and rejects 7g', () => {
  assert.equal(validateIncrement(5, defaultBlendRules.incrementGrams), true);
  assert.equal(validateIncrement(10, defaultBlendRules.incrementGrams), true);
  assert.equal(validateIncrement(7, defaultBlendRules.incrementGrams), false);
});

test('validateBlend accepts a legal custom blend and tracks totals', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', title: 'Hapjan', grams: 10, pricePerGram: 1.2}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', title: 'Makolbari', grams: 15, pricePerGram: 1.4}),
  ];

  const result = validateBlend(items, defaultBlendRules);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalGrams, 25);
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

test('validateBlend enforces minimum and maximum total weight', () => {
  assert.equal(validateBlend([makeTea({grams: 25})], defaultBlendRules).valid, true);
  assert.equal(validateBlend([makeTea({grams: 20})], defaultBlendRules).valid, false);
  assert.equal(validateBlend([makeTea({grams: 200, maxContributionGrams: 200})], defaultBlendRules).valid, true);
  assert.equal(validateBlend([makeTea({grams: 205, maxContributionGrams: 250})], defaultBlendRules).valid, false);
});

test('validateBlend allows one tea and ten unique teas, then rejects eleven', () => {
  assert.equal(validateBlend([makeTea({grams: 25})], defaultBlendRules).valid, true);

  const tenTeas = Array.from({length: 10}, (_, index) =>
    makeTea({variantId: `gid://shopify/ProductVariant/${index + 1}`, grams: 5}),
  );
  assert.equal(validateBlend(tenTeas, defaultBlendRules).valid, true);

  const elevenTeas = Array.from({length: 11}, (_, index) =>
    makeTea({variantId: `gid://shopify/ProductVariant/${index + 1}`, grams: 5}),
  );
  assert.equal(validateBlend(elevenTeas, {...defaultBlendRules, maxGrams: 100}).valid, false);
});

test('validateBlend allows same category when products are different', () => {
  const items = [
    makeTea({productId: 'gid://shopify/Product/1', variantId: 'gid://shopify/ProductVariant/1', title: 'Hapjan Black', teaType: 'Black', grams: 10}),
    makeTea({productId: 'gid://shopify/Product/2', variantId: 'gid://shopify/ProductVariant/2', title: 'Makolbari Black', teaType: 'Black', grams: 15}),
  ];

  assert.equal(validateBlend(items, defaultBlendRules).valid, true);
});

test('validateBlend rejects per-product maximum, blend-disabled, and unavailable products', () => {
  assert.equal(validateBlend([makeTea({grams: 30, maxContributionGrams: 25})], defaultBlendRules).valid, false);
  assert.equal(validateBlend([makeTea({eligible: false})], defaultBlendRules).valid, false);
  assert.equal(validateBlend([makeTea({availableForSale: false})], defaultBlendRules).valid, false);
  assert.equal(validateBlend([makeTea({quantityAvailable: 20})], defaultBlendRules).valid, false);
});

test('priceBlend includes ingredient cost and packaging charge', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', grams: 50, pricePerGram: 1.25}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', grams: 30, pricePerGram: 1.75}),
  ];

  const total = priceBlend(items, {...defaultBlendRules, packagingPrice: 18.5});

  assert.equal(total, 50 * 1.25 + 30 * 1.75 + 18.5);
});

test('calculateIngredientPriceCents and subtotal use decimal-safe minor units', () => {
  const items = [
    makeTea({grams: 10, pricePerGram: 2.2}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', grams: 15, pricePerGram: 3}),
    makeTea({variantId: 'gid://shopify/ProductVariant/3', grams: 5, pricePerGram: 2.5}),
  ];

  assert.equal(calculateIngredientPriceCents(items[0]), 2200);
  assert.equal(calculateBoxSubtotalCents(items), 7950);
  assert.equal(priceBlend(items), 79.5);
});

test('calculateTotalGrams sums ingredient grams', () => {
  assert.equal(calculateTotalGrams([makeTea({grams: 10}), makeTea({grams: 15}), makeTea({grams: 5})]), 30);
});

test('inventoryChanges reduces item inventory by exact grams after order creation', () => {
  const items = [
    makeTea({variantId: 'gid://shopify/ProductVariant/1', grams: 10}),
    makeTea({variantId: 'gid://shopify/ProductVariant/2', grams: 5}),
  ];

  const deltas = inventoryChanges(items);

  assert.deepEqual(deltas, [
    {variantId: 'gid://shopify/ProductVariant/1', delta: -10},
    {variantId: 'gid://shopify/ProductVariant/2', delta: -5},
  ]);
  assert.equal(25000 + deltas[0].delta, 24990);
  assert.equal(50000 + deltas[1].delta, 49995);
});
