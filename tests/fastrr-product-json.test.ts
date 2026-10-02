import assert from 'node:assert/strict';
import test from 'node:test';
import {loader as jsLoader} from '../app/routes/products.$handle[.js].ts';
import {loader as jsonLoader} from '../app/routes/products.$handle[.json].ts';

const product = {
  id: 'gid://shopify/Product/123',
  title: 'Assam Tea',
  handle: 'assam-tea',
  descriptionHtml: '<p>Strong tea</p>',
  vendor: 'Charaideo Reserves',
  productType: 'Black tea',
  featuredImage: {url: 'https://cdn.shopify.com/product.jpg'},
  images: {nodes: [{url: 'https://cdn.shopify.com/product.jpg'}]},
  options: [{name: 'Size'}],
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/456',
        title: '250gm',
        sku: 'TEA-250',
        availableForSale: true,
        price: {amount: '345.00'},
        compareAtPrice: {amount: '399.00'},
        image: null,
        selectedOptions: [{name: 'Size', value: '250gm'}],
      },
    ],
  },
};

function loaderArgs() {
  return {
    params: {handle: 'assam-tea'},
    context: {
      storefront: {
        query: async () => ({product}),
        CacheShort: () => ({}),
      },
    },
  } as never;
}

test('Fastrr .js compatibility route returns Shopify Ajax product data', async () => {
  const response = await jsLoader(loaderArgs());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.equal(body.id, '123');
  assert.equal(body.price, 34500);
  assert.equal(body.variants[0].id, '456');
  assert.equal(body.variants[0].compare_at_price, 39900);
});

test('Shiprocket .json compatibility route wraps the same product data', async () => {
  const response = await jsonLoader(loaderArgs());
  const body = await response.json();

  assert.equal(body.product.handle, 'assam-tea');
  assert.equal(body.product.body_html, '<p>Strong tea</p>');
  assert.equal(body.product.product_type, 'Black tea');
});
