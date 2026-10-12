import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_CHECKOUT_PROVIDER,
  resolveCheckoutProvider,
} from '../app/lib/checkout/provider.ts';
import {canStartCheckout} from '../app/lib/checkout/checkout.ts';
import {startCheckout} from '../app/lib/checkout/checkout.client.ts';

test('reserve-list Buy now uses the configured checkout provider', () => {
  const source = readFileSync(
    new URL('../app/routes/reserve-list.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /startCheckout\(rootData\.checkoutProvider/);
  assert.match(source, /canStartCheckout\(rootData\.checkoutProvider/);
  assert.doesNotMatch(source, /<AddToCartButton\s+checkout/);
});

test('checkout provider defaults to Fastrr and rejects unknown values', () => {
  assert.equal(resolveCheckoutProvider(undefined), DEFAULT_CHECKOUT_PROVIDER);
  assert.equal(resolveCheckoutProvider(' FASTRR '), 'fastrr');
  assert.equal(resolveCheckoutProvider('razorpay'), 'razorpay');
  assert.equal(resolveCheckoutProvider('unknown'), null);
});

test('shared checkout launcher preserves the current Fastrr payload', async () => {
  const products = [{variantId: 'gid://shopify/ProductVariant/12345', quantity: 2}];
  assert.equal(canStartCheckout('fastrr', products), true);
  assert.equal(canStartCheckout('razorpay', products), true);

  let received: unknown;
  Object.assign(globalThis, {
    window: {
      shiprocketCheckoutEvents: {
        buyDirect: (payload: unknown) => {
          received = payload;
        },
      },
    },
  });

  try {
    assert.equal(
      await startCheckout('fastrr', {
        source: 'cart',
        products,
        couponCode: 'TEA10',
        utmParams: 'utm_source=test',
        cartAttributes: {gift: 'yes'},
      }),
      true,
    );
    assert.deepEqual(received, {
      type: 'cart',
      products: [{variantId: '12345', quantity: 2}],
      couponCode: 'TEA10',
      utmParams: 'utm_source=test',
      cartAttributes: {
        gift: 'yes',
        __cr_checkout_provider: 'fastrr',
      },
    });
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

test('Fastrr checkout preserves mixed-cart products and treats coupon codes as provider metadata', async () => {
  const products = [
    {variantId: 'gid://shopify/ProductVariant/101', quantity: 2},
    {variantId: 'gid://shopify/ProductVariant/202', quantity: 1},
    {variantId: 'gid://shopify/ProductVariant/303', quantity: 4},
  ];
  let received: unknown;
  Object.assign(globalThis, {
    window: {
      shiprocketCheckoutEvents: {
        buyDirect: (payload: unknown) => {
          received = payload;
        },
      },
    },
  });

  try {
    assert.equal(
      await startCheckout('fastrr', {
        source: 'cart',
        products,
        couponCode: 'COUPON_A',
      }),
      true,
    );
    assert.deepEqual(received, {
      type: 'cart',
      products: [
        {variantId: '101', quantity: 2},
        {variantId: '202', quantity: 1},
        {variantId: '303', quantity: 4},
      ],
      couponCode: 'COUPON_A',
      cartAttributes: {__cr_checkout_provider: 'fastrr'},
    });
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
