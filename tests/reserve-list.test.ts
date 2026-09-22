import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chapterState,
  partitionReserveCollections,
  type ReserveCollection,
} from '../app/lib/reserve-list.ts';

function collection(title: string, availability: boolean[]): ReserveCollection {
  return {
    title,
    handle: title.toLowerCase().replaceAll(' ', '-'),
    description: '',
    products: availability.map((availableForSale, index) => ({
      title: `Product ${index}`,
      handle: `product-${index}`,
      availableForSale,
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

test('chapter state follows storefront sale availability', () => {
  assert.equal(chapterState(collection('Chapter I', [false, false])), 'coming-soon');
  assert.equal(chapterState(collection('Chapter II', [])), 'locked');
  assert.equal(chapterState(collection('Chapter III', [false, true])), 'open');
});
