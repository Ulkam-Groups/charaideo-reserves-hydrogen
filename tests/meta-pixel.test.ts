import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeMetaPurchase,
  DEFAULT_META_PIXEL_ID,
  metaCommerceParameters,
  metaContentId,
  metaPurchaseFromShopifyOrder,
  pendingMetaPurchases,
  queueMetaPurchase,
  parseMetaCommercePayload,
  resolveMetaPixelId,
} from '../app/lib/ads/meta/meta-pixel.ts';

test('uses the Charaideo Reserves Meta Pixel by default', () => {
  assert.equal(resolveMetaPixelId(), DEFAULT_META_PIXEL_ID);
});

test('accepts a configured numeric Meta Pixel ID', () => {
  assert.equal(resolveMetaPixelId(' 123456789 '), '123456789');
});

test('rejects an invalid configured Meta Pixel ID', () => {
  assert.equal(resolveMetaPixelId('pixel-123'), null);
});

test('normalizes Shopify product and variant GIDs for Meta catalog matching', () => {
  assert.equal(metaContentId('gid://shopify/ProductVariant/12345'), '12345');
  assert.equal(metaContentId('gid://shopify/Product/98765'), '98765');
  assert.equal(metaContentId('not-a-shopify-id'), null);
});

test('builds Meta commerce parameters with value, currency, contents and order ID', () => {
  const payload = parseMetaCommercePayload({
    currency: 'INR',
    eventId: 'meta_purchase_order_123',
    orderId: '#1018',
    value: 499,
    items: [{id: '12345', quantity: 2, itemPrice: 249.5}],
  });
  assert.ok(payload);
  assert.deepEqual(metaCommerceParameters(payload), {
    content_ids: ['12345'],
    content_type: 'product',
    contents: [{id: '12345', quantity: 2, item_price: 249.5}],
    currency: 'INR',
    num_items: 2,
    value: 499,
    order_id: '#1018',
  });
});

test('rejects malformed Meta commerce payloads', () => {
  assert.equal(
    parseMetaCommercePayload({
      currency: 'INR',
      value: -1,
      items: [{id: 'variant-one', quantity: 0, itemPrice: -10}],
    }),
    null,
  );
});

const fastrrOrder = {
  id: 987654321,
  name: '#1042',
  created_at: '2026-10-04T10:00:00Z',
  currency: 'INR',
  total_price: '549.00',
  financial_status: 'paid',
  note_attributes: [
    {name: '__cr_checkout_provider', value: 'fastrr'},
    {name: '__cr_meta_consent', value: '1'},
    {name: '__cr_meta_fbp', value: 'fb.1.1720000000.123456789'},
    {name: '__cr_meta_source_url', value: 'https://example.com/cart'},
  ],
  email: 'Customer@Example.com',
  billing_address: {
    first_name: 'Ada',
    last_name: 'Lovelace',
    city: 'Guwahati',
    province_code: 'AS',
    zip: '781001',
    country_code: 'IN',
  },
  line_items: [
    {
      variant_id: 12345,
      quantity: 2,
      price: '249.50',
      title: 'Assam Tea',
      variant_title: '100g',
      vendor: 'Charaideo Reserves',
    },
  ],
};

test('builds a stable, hashed Meta CAPI Purchase for a consented Fastrr order', async () => {
  const event = await metaPurchaseFromShopifyOrder(fastrrOrder, 'orders/paid');
  assert.ok(event);
  assert.equal(event.event_id, 'meta_purchase_shopify_987654321');
  assert.equal(event.event_source_url, 'https://example.com/cart');
  assert.equal(event.custom_data.value, 549);
  assert.deepEqual(event.custom_data.content_ids, ['12345']);
  assert.equal(event.user_data.fbp, 'fb.1.1720000000.123456789');
  assert.notEqual(event.user_data.em?.[0], 'customer@example.com');
  assert.match(event.user_data.em?.[0] ?? '', /^[a-f0-9]{64}$/);
});

test('reports pending COD at creation but waits for prepaid payment', async () => {
  const pending = {...fastrrOrder, financial_status: 'pending'};
  assert.equal(await metaPurchaseFromShopifyOrder(pending, 'orders/create'), null);
  assert.ok(
    await metaPurchaseFromShopifyOrder(
      {...pending, gateway_names: ['Cash on Delivery (COD)']},
      'orders/create',
    ),
  );
});

test('does not report unconsented or non-Fastrr Shopify orders', async () => {
  assert.equal(
    await metaPurchaseFromShopifyOrder(
      {...fastrrOrder, note_attributes: []},
      'orders/paid',
    ),
    null,
  );
  assert.equal(
    await metaPurchaseFromShopifyOrder(
      {
        ...fastrrOrder,
        note_attributes: [{name: '__cr_checkout_provider', value: 'fastrr'}],
      },
      'orders/paid',
    ),
    null,
  );
});

test('queues a verified browser Purchase until Meta Pixel acknowledges it', () => {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
  Object.assign(globalThis, {
    document: new EventTarget(),
    window: {sessionStorage},
  });

  try {
    const purchase = {
      currency: 'INR',
      eventId: 'meta_purchase_order_test',
      items: [{id: '12345', itemPrice: 499, quantity: 1}],
      orderId: '#1042',
      value: 499,
    };
    assert.equal(queueMetaPurchase(purchase), true);
    assert.deepEqual(pendingMetaPurchases(), [purchase]);

    // Re-rendering the success route cannot enqueue the same Purchase twice.
    assert.equal(queueMetaPurchase(purchase), true);
    assert.deepEqual(pendingMetaPurchases(), [purchase]);

    acknowledgeMetaPurchase(purchase);
    assert.deepEqual(pendingMetaPurchases(), []);
  } finally {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
  }
});
