import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHECKOUT_PROVIDER,
  resolveCheckoutProvider,
} from '../app/lib/checkout/provider.ts';
import {
  canStartCheckout,
  startCheckout,
} from '../app/lib/checkout/checkout.client.ts';

test('checkout provider defaults to Fastrr and rejects unknown values', () => {
  assert.equal(resolveCheckoutProvider(undefined), DEFAULT_CHECKOUT_PROVIDER);
  assert.equal(resolveCheckoutProvider(' FASTRR '), 'fastrr');
  assert.equal(resolveCheckoutProvider('razorpay'), 'razorpay');
  assert.equal(resolveCheckoutProvider('unknown'), null);
});

test('shared checkout launcher preserves the current Fastrr payload', () => {
  const products = [
    {variantId: 'gid://shopify/ProductVariant/12345', quantity: 2},
  ];
  assert.equal(canStartCheckout('fastrr', products), true);
  assert.equal(canStartCheckout('razorpay', products), false);

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
      startCheckout('fastrr', {
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
      cartAttributes: {gift: 'yes'},
    });
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
