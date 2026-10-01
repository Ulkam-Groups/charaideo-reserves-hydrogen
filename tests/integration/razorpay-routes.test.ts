import assert from 'node:assert/strict';
import test from 'node:test';

import type {ActionFunctionArgs} from 'react-router';
import {action as orderAction} from '../../app/routes/api.checkout.razorpay.order.ts';
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

test('Razorpay order route can create and persist a feature-flagged draft anchor', async () => {
  const originalFetch = globalThis.fetch;
  const session = new Map<string, unknown>();
  let razorpayPayload: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    if (url.includes('/admin/api/2026-07/graphql.json')) {
      return Response.json({
        data: {
          draftOrderCreate: {
            draftOrder: {
              id: 'gid://shopify/DraftOrder/123',
              name: '#D1',
              status: 'OPEN',
            },
            userErrors: [],
          },
        },
      });
    }
    if (url === 'https://api.razorpay.com/v1/orders') {
      razorpayPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({id: 'order_anchor123', amount: 100});
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const response = await orderAction({
      request: formRequest(
        '/api/checkout/razorpay/order',
        new URLSearchParams({
          source: 'product',
          products: JSON.stringify([
            {variantId: 'gid://shopify/ProductVariant/12345', quantity: 1},
          ]),
        }),
      ),
      params: {},
      context: {
        env: {
          CHECKOUT_PROVIDER: 'razorpay',
          RAZORPAY_KEY_ID: 'rzp_test_public',
          RAZORPAY_KEY_SECRET: 'secret',
          RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
          RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
          PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
          SHOPIFY_ADMIN_CLIENT_ID: 'client',
          SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
        },
        storefront: {
          query: async () => ({
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/12345',
                title: 'Default Title',
                sku: 'TEA-1',
                availableForSale: true,
                price: {amount: '1.00', currencyCode: 'INR'},
                compareAtPrice: null,
                image: null,
                product: {
                  id: 'gid://shopify/Product/1',
                  title: 'Test Tea',
                  description: 'Tea',
                  handle: 'test-tea',
                },
              },
            ],
          }),
        },
        session: {
          set: (key: string, value: unknown) => session.set(key, value),
          unset: (key: string) => session.delete(key),
        },
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 200);
    assert.equal(session.get('razorpayOrderId'), 'order_anchor123');
    assert.equal(session.get('razorpayDraftOrderId'), 'gid://shopify/DraftOrder/123');
    assert.equal(
      (razorpayPayload?.notes as Record<string, unknown>).shopify_draft_order_id,
      'gid://shopify/DraftOrder/123',
    );
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
  assert.equal(order.status, 404);
  assert.equal(verify.status, 404);
});
