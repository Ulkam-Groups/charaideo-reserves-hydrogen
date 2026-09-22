import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findChapterCollection,
  selectStockedChapterProduct,
} from '../app/lib/chapter-inventory.ts';

const soldOut = {availableForSale: false, currentlyNotInStock: false};
const backorder = {availableForSale: true, currentlyNotInStock: true};
const inStock = {availableForSale: true, currentlyNotInStock: false};

test('five zero-stock products keep Chapter I sealed, including backorders', () => {
  assert.equal(
    selectStockedChapterProduct([
      ...Array.from({length: 4}, () => ({variants: {nodes: [soldOut]}})),
      {variants: {nodes: [backorder]}},
    ]),
    null,
  );
});

test('adding stock to any product opens its collection', () => {
  const stocked = {variants: {nodes: [soldOut, inStock]}, handle: 'chapter-one-tea'};
  assert.equal(
    selectStockedChapterProduct([
      ...Array.from({length: 4}, () => ({
        variants: {nodes: [soldOut]},
        handle: 'sealed',
      })),
      stocked,
    ]),
    stocked,
  );
});

test('empty chapters remain Coming Soon and collections match their titles', () => {
  const collections = [
    {title: 'Chapter I', handle: 'chapter-i', products: [{variants: {nodes: [soldOut]}}]},
    {title: 'Chapter II', handle: 'chapter-ii', products: []},
  ];
  assert.equal(findChapterCollection(collections, 'chapter i')?.handle, 'chapter-i');
  assert.equal(selectStockedChapterProduct(collections[1].products), null);
  assert.equal(findChapterCollection(collections, 'Chapter III'), null);
});
