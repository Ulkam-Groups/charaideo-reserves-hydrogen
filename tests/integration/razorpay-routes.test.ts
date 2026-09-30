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

test('Razorpay verification creates Shopify order before redirecting', async () => {
  const orderId = 'order_signed123';
  const paymentId = 'pay_signed123';
  const keySecret = 'razorpay-key-secret';
  const signature = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  let verifiedSession: unknown;
  let orderSessionUnset = false;
  let removedLineIds: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.endsWith(`/v1/orders/${orderId}`)) {
      return Response.json({
        id: orderId,
        amount: 100,
        amount_paid: 100,
        amount_due: 0,
        currency: 'INR',
        status: 'paid',
        line_items_total: 100,
        shipping_fee: 0,
        cod_fee: 0,
        notes: {items_0: '48839766802529:1:100'},
        customer_details: {
          contact: '+919000000000',
          email: 'buyer@example.com',
          shipping_address: {
            name: 'Test Buyer',
            line1: 'Test address',
            city: 'Tinsukia',
            state: 'Assam',
            zipcode: '786125',
            country: 'in',
            contact: '+919000000000',
          },
        },
      });
    }
    if (request.url.endsWith(`/v1/payments/${paymentId}`)) {
      return Response.json({
        id: paymentId,
        order_id: orderId,
        amount: 100,
        currency: 'INR',
        status: 'captured',
        captured: true,
        method: 'upi',
      });
    }
    if (request.url.endsWith('/admin/oauth/access_token')) {
      return Response.json({
        access_token: 'admin-token',
        expires_in: 86_399,
        scope: 'read_orders,write_orders',
      });
    }
    if (request.url.endsWith('/graphql.json')) {
      const body = (await request.json()) as {query?: string};
      if (body.query?.includes('RazorpayExistingOrder')) {
        return Response.json({data: {orders: {nodes: []}}});
      }
      return Response.json({
        data: {
          orderCreate: {
            order: {id: 'gid://shopify/Order/123', name: '#1012'},
            userErrors: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${request.url}`);
  }) as typeof fetch;

  try {
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
          SHOPIFY_ADMIN_STORE_DOMAIN: 'store.myshopify.com',
          SHOPIFY_ADMIN_CLIENT_ID: 'client-id',
          SHOPIFY_ADMIN_CLIENT_SECRET: 'client-secret',
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
      razorpayPaymentId: paymentId,
      shopifyOrderId: 'gid://shopify/Order/123',
      shopifyOrderName: '#1012',
      paymentMethod: 'prepaid',
      verifiedAt: (verifiedSession as {verifiedAt: number}).verifiedAt,
    });
    assert.equal(typeof (verifiedSession as {verifiedAt: unknown}).verifiedAt, 'number');
  } finally {
    globalThis.fetch = originalFetch;
  }
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
