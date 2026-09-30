import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';

import type {ActionFunctionArgs} from 'react-router';
import {action as orderAction} from '../../app/routes/api.checkout.razorpay.order.ts';
import {action as statusAction} from '../../app/routes/api.checkout.razorpay.status.ts';
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

test('Razorpay verification accepts a signed callback without upstream API calls', async () => {
  const orderId = 'order_signed123';
  const paymentId = 'pay_signed123';
  const keySecret = 'razorpay-key-secret';
  const signature = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  let verifiedSession: unknown;
  let orderSessionUnset = false;
  let removedLineIds: string[] = [];

  const response = await verifyAction({
    request: formRequest(
      '/api/checkout/razorpay/verify',
      new URLSearchParams({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    ),
    params: {},
    context: {
      env: {
        CHECKOUT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: keySecret,
      },
      session: {
        get: (key: string) => (key === 'razorpayOrderId' ? orderId : undefined),
        unset: (key: string) => {
          if (key === 'razorpayOrderId') orderSessionUnset = true;
        },
        set: (key: string, value: unknown) => {
          if (key === 'razorpayPaymentVerified') verifiedSession = value;
        },
      },
      cart: {
        get: async () => ({lines: {nodes: [{id: 'line-1'}]}}),
        removeLines: async (lineIds: string[]) => {
          removedLineIds = lineIds;
        },
      },
    },
  } as unknown as ActionFunctionArgs);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    redirectTo: '/checkout/razorpay/success',
  });
  assert.equal(orderSessionUnset, true);
  assert.deepEqual(removedLineIds, ['line-1']);
  assert.deepEqual(verifiedSession, {
    razorpayOrderId: orderId,
    shopifyOrderId: null,
    shopifyOrderName: null,
    paymentMethod: 'prepaid',
    verifiedAt: (verifiedSession as {verifiedAt: number}).verifiedAt,
  });
  assert.equal(typeof (verifiedSession as {verifiedAt: unknown}).verifiedAt, 'number');
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
  const status = await statusAction({
    request: formRequest('/api/checkout/razorpay/status', new URLSearchParams()),
    params: {},
    context,
  } as unknown as ActionFunctionArgs);
  assert.equal(order.status, 404);
  assert.equal(verify.status, 404);
  assert.equal(status.status, 404);
});
