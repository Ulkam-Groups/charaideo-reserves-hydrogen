import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';

import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {action as orderAction} from '../../app/routes/api.checkout.razorpay.order.ts';
import {action as verifyAction} from '../../app/routes/api.checkout.razorpay.verify.ts';
import {loader as successLoader} from '../../app/routes/checkout.razorpay.success.tsx';

const origin = 'https://store.example';

test('Razorpay success uses only verified session references and performs no lookup', () => {
  const session = new Map<string, unknown>([
    [
      'razorpayPaymentVerified',
      {
        shopifyOrderId: 'gid://shopify/Order/1018',
        shopifyOrderName: '#1018',
        razorpayOrderId: 'order_abc123',
        razorpayPaymentId: 'pay_abc123',
      },
    ],
  ]);
  const result = successLoader({
    request: new Request(`${origin}/checkout/razorpay/success`),
    params: {},
    context: {
      session: {
        get: (key: string) => session.get(key),
        unset: (key: string) => session.delete(key),
      },
    },
  } as unknown as LoaderFunctionArgs);

  assert.deepEqual(result.data, {
    shopifyOrderName: '#1018',
    razorpayOrderId: 'order_abc123',
    razorpayPaymentId: 'pay_abc123',
  });
  assert.equal(
    new Headers(result.init?.headers).get('Cache-Control'),
    'private, no-store',
  );
  assert.equal(session.has('razorpayPaymentVerified'), false);
});

test('Razorpay success rejects confirmation without a Shopify order ID', () => {
  const session = new Map<string, unknown>([
    ['razorpayPaymentVerified', {shopifyOrderName: '#1018'}],
  ]);

  assert.throws(
    () =>
      successLoader({
        request: new Request(`${origin}/checkout/razorpay/success`),
        params: {},
        context: {
          session: {
            get: (key: string) => session.get(key),
            unset: (key: string) => session.delete(key),
          },
        },
      } as unknown as LoaderFunctionArgs),
    (error: unknown) => error instanceof Response && error.status === 302,
  );
});

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

test('Razorpay verification completes its feature-flagged draft anchor', async () => {
  const originalFetch = globalThis.fetch;
  const orderId = 'order_complete123';
  const paymentId = 'pay_complete123';
  const keySecret = 'razorpay-secret';
  const draftOrderId = 'gid://shopify/DraftOrder/123';
  const session = new Map<string, unknown>([
    ['razorpayOrderId', orderId],
    ['razorpayDraftOrderId', draftOrderId],
  ]);
  const graphqlOperations: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === `https://api.razorpay.com/v1/orders/${orderId}`) {
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
        notes: {
          source: 'product',
          items_0: '12345:1:100',
          shopify_draft_order_id: draftOrderId,
        },
        customer_details: {
          contact: '9876543210',
          email: 'buyer@example.com',
          shipping_address: {
            name: 'Tea Buyer',
            line1: 'Tea Road',
            city: 'Dibrugarh',
            state: 'Assam',
            zipcode: '786001',
            country: 'IN',
            contact: '9876543210',
          },
        },
      });
    }
    if (url === `https://api.razorpay.com/v1/payments/${paymentId}`) {
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
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    if (url.includes('/admin/api/2026-07/graphql.json')) {
      const request = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      graphqlOperations.push(request.query);
      if (request.query.includes('query RazorpayDraftOrder')) {
        return Response.json({
          data: {
            draftOrder: {
              id: draftOrderId,
              status: 'OPEN',
              totalPriceSet: {
                presentmentMoney: {amount: '1.00', currencyCode: 'INR'},
              },
              order: null,
            },
          },
        });
      }
      if (request.query.includes('mutation UpdateRazorpayDraftOrder')) {
        return Response.json({
          data: {
            draftOrderUpdate: {
              draftOrder: {
                id: draftOrderId,
                status: 'OPEN',
                totalPriceSet: {
                  presentmentMoney: {amount: '1.00', currencyCode: 'INR'},
                },
                order: null,
              },
              userErrors: [],
            },
          },
        });
      }
      if (request.query.includes('mutation CompleteRazorpayDraftOrder')) {
        return Response.json({
          data: {
            draftOrderComplete: {
              draftOrder: {
                id: draftOrderId,
                status: 'COMPLETED',
                order: {id: 'gid://shopify/Order/1018', name: '#1018'},
              },
              userErrors: [],
            },
          },
        });
      }
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const signature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
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
          RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
          PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
          SHOPIFY_ADMIN_CLIENT_ID: 'client',
          SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
        },
        session: {
          get: (key: string) => session.get(key),
          set: (key: string, value: unknown) => session.set(key, value),
          unset: (key: string) => session.delete(key),
        },
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      redirectTo: '/checkout/razorpay/success',
    });
    assert.equal(session.has('razorpayOrderId'), false);
    assert.equal(session.has('razorpayDraftOrderId'), false);
    assert.deepEqual(session.get('razorpayPaymentVerified'), {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      shopifyOrderId: 'gid://shopify/Order/1018',
      shopifyOrderName: '#1018',
    });
    assert.equal(
      graphqlOperations.some((operation) => operation.includes('orderCreate')),
      false,
    );
    assert.equal(
      graphqlOperations.filter((operation) =>
        operation.includes('mutation CompleteRazorpayDraftOrder'),
      ).length,
      1,
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
