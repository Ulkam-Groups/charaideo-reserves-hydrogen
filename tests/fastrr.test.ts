import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startFastrrCheckout,
  type FastrrCheckoutInput,
} from '../app/lib/checkout/providers/fastrr/fastrr.client.ts';
import {fastrrVariantId} from '../app/lib/checkout/providers/fastrr/fastrr.ts';
import {FASTRR_CSP} from '../app/lib/checkout/providers/fastrr/fastrr.config.ts';

test('Fastrr CSP permits only the exact Shiprocket runtime origins it uses', () => {
  assert.ok(FASTRR_CSP.frameSrc.includes('https://sr-cdn.shiprocket.in'));
  assert.ok(FASTRR_CSP.connectSrc.includes('https://uc.shiprocket.in'));
  assert.equal(
    [...FASTRR_CSP.frameSrc, ...FASTRR_CSP.connectSrc].some((origin) =>
      origin.includes('*.shiprocket.in'),
    ),
    false,
  );
});

test('Fastrr receives the numeric Shopify variant ID', () => {
  assert.equal(fastrrVariantId('gid://shopify/ProductVariant/12345'), '12345');
  assert.equal(fastrrVariantId('gid://shopify/Product/12345'), null);
  assert.equal(fastrrVariantId('not-a-shopify-id'), null);
});

test('checkout reports vendor availability without redirecting', () => {
  const input: FastrrCheckoutInput = {
    type: 'product',
    products: [{variantId: '12345', quantity: 1}],
  };
  assert.equal(startFastrrCheckout(input), false);

  let received: FastrrCheckoutInput | undefined;
  Object.assign(globalThis, {
    window: {
      shiprocketCheckoutEvents: {
        buyDirect: (payload: FastrrCheckoutInput) => {
          received = payload;
        },
      },
    },
  });
  try {
    assert.equal(startFastrrCheckout(input), true);
    assert.deepEqual(received, input);
    window.shiprocketCheckoutEvents!.buyDirect = () => {
      throw new Error('vendor unavailable');
    };
    assert.equal(startFastrrCheckout(input), false);
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
