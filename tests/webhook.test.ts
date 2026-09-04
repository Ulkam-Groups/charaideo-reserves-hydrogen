import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryChanges} from '../app/lib/blend.ts';

test('inventoryChanges maps ingredient grams to negative deltas', () => {
  const items = [
    {variantId: 'gid://shopify/ProductVariant/1', grams: 50},
    {variantId: 'gid://shopify/ProductVariant/2', grams: 25},
  ];
  const deltas = inventoryChanges(items as any);
  assert.deepEqual(deltas, [
    {variantId: 'gid://shopify/ProductVariant/1', delta: -50},
    {variantId: 'gid://shopify/ProductVariant/2', delta: -25},
  ]);
});

test('order webhook recipe extraction from line item properties', () => {
  const lineItems = [
    {properties: [{name: 'tea_blend', value: JSON.stringify({items: [{variantId: 'v1', grams: 10}]})}]},
    {properties: [{name: 'other', value: 'x'}]},
  ];
  const recipe = lineItems.flatMap((line: any) => line.properties || []).find((p: any) => p.name === 'tea_blend')?.value;
  assert.ok(recipe);
  const parsed = JSON.parse(recipe);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].variantId, 'v1');
});
