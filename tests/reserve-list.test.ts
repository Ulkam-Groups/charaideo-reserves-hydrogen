import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chapterState,
  partitionReserveCollections,
  type ReserveCollection,
} from '../app/lib/reserve-list.ts';

function collection(title: string, quantities: Array<number | null>): ReserveCollection {
  return {
    title,
    handle: title.toLowerCase().replaceAll(' ', '-'),
    description: '',
    products: quantities.map((quantity, index) => ({
      title: `Product ${index}`,
      handle: `product-${index}`,
      variants: {nodes: [{quantityAvailable: quantity}]},
    })),
  };
}

test('chapters are sorted numerically and separated from other collections', () => {
  const result = partitionReserveCollections([
    collection('Craft Collection', []),
    collection('Chapter III', []),
    collection('Chapter I', []),
    collection('Reserve Collection', []),
    collection('Chapter II', []),
  ]);
  assert.deepEqual(
    result.chapters.map(({title}) => title),
    ['Chapter I', 'Chapter II', 'Chapter III'],
  );
  assert.deepEqual(
    result.others.map(({title}) => title),
    ['Craft Collection', 'Reserve Collection'],
  );
});

test('chapter state follows actual quantity, including zero and unknown inventory', () => {
  assert.equal(chapterState(collection('Chapter I', [0, 0])), 'coming-soon');
  assert.equal(chapterState(collection('Chapter II', [])), 'locked');
  assert.equal(chapterState(collection('Chapter III', [null, 2])), 'open');
});
