import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findChapterCollection,
  selectStockedChapterProduct,
} from '../app/lib/chapter-inventory.ts';

test('five zero-inventory products keep Chapter I sealed', () => {
  assert.equal(
    selectStockedChapterProduct(Array.from({length: 5}, () => ({totalInventory: 0}))),
    null,
  );
});

test('adding stock to any product opens its collection', () => {
  const stocked = {totalInventory: 12, handle: 'chapter-one-tea'};
  assert.equal(
    selectStockedChapterProduct([
      ...Array.from({length: 4}, () => ({totalInventory: 0, handle: 'sealed'})),
      stocked,
    ]),
    stocked,
  );
});

test('empty chapters remain Coming Soon and collections match their titles', () => {
  const collections = [
    {title: 'Chapter I', handle: 'chapter-i', products: [{totalInventory: 0}]},
    {title: 'Chapter II', handle: 'chapter-ii', products: []},
  ];
  assert.equal(findChapterCollection(collections, 'chapter i')?.handle, 'chapter-i');
  assert.equal(selectStockedChapterProduct(collections[1].products), null);
  assert.equal(findChapterCollection(collections, 'Chapter III'), null);
});
