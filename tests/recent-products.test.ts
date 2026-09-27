import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readRecentProducts,
  rememberRecentProduct,
  type RecentProduct,
} from '../app/lib/recent-products.ts';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function product(overrides: Partial<RecentProduct> = {}): RecentProduct {
  return {
    handle: 'assam-breakfast',
    title: 'Assam Breakfast',
    variantId: 'gid://shopify/ProductVariant/1',
    variantTitle: '100g',
    price: {amount: '499.00', currencyCode: 'INR'},
    image: {
      url: 'https://cdn.shopify.com/product.jpg',
      altText: 'Assam Breakfast tea',
    },
    viewedAt: 1,
    ...overrides,
  };
}

test('stores the most recently viewed variant first and deduplicates it', () => {
  const storage = createStorage();
  rememberRecentProduct(storage, product());
  rememberRecentProduct(storage, product({title: 'Updated title', viewedAt: 2}));

  const recent = readRecentProducts(storage);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].title, 'Updated title');
  assert.equal(recent[0].viewedAt, 2);
});

test('keeps only four valid recent variants', () => {
  const storage = createStorage();
  for (let index = 1; index <= 5; index++) {
    rememberRecentProduct(
      storage,
      product({
        variantId: `gid://shopify/ProductVariant/${index}`,
        viewedAt: index,
      }),
    );
  }

  assert.deepEqual(
    readRecentProducts(storage).map((item) => item.viewedAt),
    [5, 4, 3, 2],
  );
});

test('ignores corrupt or unsafe stored products', () => {
  const storage = createStorage();
  storage.setItem('charaideo:recent-products:v1', '{invalid');
  assert.deepEqual(readRecentProducts(storage), []);

  rememberRecentProduct(
    storage,
    product({image: {url: 'javascript:alert(1)', altText: ''}}),
  );
  assert.deepEqual(readRecentProducts(storage), []);
});
