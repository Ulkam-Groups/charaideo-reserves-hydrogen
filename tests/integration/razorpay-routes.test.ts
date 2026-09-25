import assert from 'node:assert/strict';
import test from 'node:test';

import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {action as orderAction} from '../../app/routes/api.checkout.razorpay.order.ts';
import {
  action as shippingAction,
  loader as shippingLoader,
} from '../../app/routes/api.checkout.razorpay.shipping.ts';
import {action as verifyAction} from '../../app/routes/api.checkout.razorpay.verify.ts';

const origin = 'https://store.example';

function formRequest(path: string, body: URLSearchParams) {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });
}

test('Razorpay shipping route returns documented methods and rejects bad requests', async () => {
  const context = {
    env: {
      CHECKOUT_PROVIDER: 'razorpay',
      RAZORPAY_SHIPPING_FEE_PAISE: '1000',
      RAZORPAY_COD_ENABLED: 'false',
    },
  };
  const response = await shippingAction({
    request: new Request(`${origin}/api/checkout/razorpay/shipping`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        order_id: 'receipt-1',
        razorpay_order_id: 'EKwxwAgItmXXXX',
        contact: '+919000090000',
        addresses: [
          {id: '0', zipcode: '786001', state_code: 'AS', country: 'IN'},
          {id: '1', zipcode: 'invalid', country: 'IN'},
        ],
      }),
    }),
    context,
    params: {},
  } as unknown as ActionFunctionArgs);

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    addresses: Array<{shipping_methods: Array<Record<string, unknown>>}>;
  };
  assert.deepEqual(body.addresses[0].shipping_methods[0], {
    id: 'standard',
    description: 'Standard delivery',
    name: 'Standard delivery',
    serviceable: true,
    shipping_fee: 1000,
    cod: false,
    cod_fee: 0,
  });
  assert.equal(body.addresses[1].shipping_methods[0].serviceable, false);

  const wrongType = await shippingAction({
    request: new Request(`${origin}/api/checkout/razorpay/shipping`, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: '{}',
    }),
    context,
    params: {},
  } as unknown as ActionFunctionArgs);
  assert.equal(wrongType.status, 400);

  const missingFee = await shippingLoader({
    request: new Request(
      `${origin}/api/checkout/razorpay/shipping?addresses=${encodeURIComponent(
        JSON.stringify([{id: '0', zipcode: '786001', country: 'IN'}]),
      )}`,
    ),
    context: {env: {CHECKOUT_PROVIDER: 'razorpay'}},
    params: {},
  } as unknown as LoaderFunctionArgs);
  assert.equal(missingFee.status, 503);
});

test('Razorpay order route rejects invalid products before external calls', async () => {
  const response = await orderAction({
    request: formRequest(
      '/api/checkout/razorpay/order',
      new URLSearchParams({source: 'product', products: '[]'}),
    ),
    params: {},
    context: {
      env: {
        CHECKOUT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'secret',
        RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
        RAZORPAY_SHIPPING_FEE_PAISE: '0',
        PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
        SHOPIFY_ADMIN_CLIENT_ID: 'client',
        SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      },
    },
  } as unknown as ActionFunctionArgs);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error: 'Invalid checkout request'});
});

test('Razorpay verification is bound to the server-side order id', async () => {
  let unset = false;
  const response = await verifyAction({
    request: formRequest(
      '/api/checkout/razorpay/verify',
      new URLSearchParams({
        razorpay_order_id: 'order_returned',
        razorpay_payment_id: 'pay_abc123',
        razorpay_signature: 'a'.repeat(64),
      }),
    ),
    params: {},
    context: {
      env: {
        CHECKOUT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'secret',
      },
      session: {
        get: () => 'order_created_on_server',
        unset: () => {
          unset = true;
        },
      },
    },
  } as unknown as ActionFunctionArgs);

  assert.equal(response.status, 400);
  assert.equal(unset, false);
});

test('Razorpay browser endpoints are unavailable when FastRR is selected', async () => {
  const context = {env: {CHECKOUT_PROVIDER: 'fastrr'}};
  const order = await orderAction({
    request: formRequest(
      '/api/checkout/razorpay/order',
      new URLSearchParams({source: 'product', products: '[]'}),
    ),
    params: {},
    context,
  } as unknown as ActionFunctionArgs);
  const verify = await verifyAction({
    request: formRequest(
      '/api/checkout/razorpay/verify',
      new URLSearchParams({
        razorpay_order_id: 'order_abc',
        razorpay_payment_id: 'pay_abc',
        razorpay_signature: 'a'.repeat(64),
      }),
    ),
    params: {},
    context,
  } as unknown as ActionFunctionArgs);
  const shipping = await shippingAction({
    request: new Request(`${origin}/api/checkout/razorpay/shipping`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({addresses: [{id: '0', zipcode: '786001', country: 'IN'}]}),
    }),
    params: {},
    context,
  } as unknown as ActionFunctionArgs);

  assert.equal(order.status, 404);
  assert.equal(verify.status, 404);
  assert.equal(shipping.status, 404);
});
