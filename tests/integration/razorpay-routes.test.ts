import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';

import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {action as orderAction} from '../../app/routes/api.checkout.razorpay.order.ts';
import {action as verifyAction} from '../../app/routes/api.checkout.razorpay.verify.ts';
import {action as cartClearAfterCheckoutAction} from '../../app/routes/api.cart-clear-after-checkout.ts';
import {clearCartAfterSuccessfulCheckout} from '../../app/lib/checkout/cart-clear.server.ts';
import {loader as successLoader} from '../../app/routes/checkout.razorpay.success.tsx';

const origin = 'https://store.example';

test('successful checkout cart cleanup removes all cart lines', async () => {
  const removed: string[][] = [];
  const cart = {
    get: async () => ({lines: {nodes: [{id: 'line-1'}, {id: 'line-2'}]}}),
    removeLines: async (lineIds: string[]) => {
      removed.push(lineIds);
      return {errors: []};
    },
  };

  assert.equal(await clearCartAfterSuccessfulCheckout(cart), true);
  assert.deepEqual(removed, [['line-1', 'line-2']]);
});

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
    clearCart: false,
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

test('verified cart cleanup action accepts its protected background form', async () => {
  const session = new Map<string, unknown>([
    ['razorpayCartClearPending', {razorpayOrderId: 'order_abc123'}],
  ]);
  const removed: string[][] = [];
  const response = await cartClearAfterCheckoutAction({
    request: formRequest(
      '/api/cart-clear-after-checkout',
      new URLSearchParams({intent: 'clear-cart'}),
    ),
    params: {},
    context: {
      session: {
        get: (key: string) => session.get(key),
        unset: (key: string) => session.delete(key),
      },
      cart: {
        get: async () => ({lines: {nodes: [{id: 'line-1'}]}}),
        removeLines: async (lineIds: string[]) => {
          removed.push(lineIds);
          return {errors: []};
        },
      },
    },
  } as unknown as ActionFunctionArgs);

  assert.equal(
    response instanceof Response ? response.status : response.init?.status,
    200,
  );
  assert.deepEqual(removed, [['line-1']]);
  assert.equal(session.has('razorpayCartClearPending'), false);
});

test('Razorpay order route rejects invalid products before external calls', async () => {
  const requestId = '11111111-2222-4333-8444-555555555555';
  const request = formRequest(
    '/api/checkout/razorpay/order',
    new URLSearchParams({source: 'product', products: '[]'}),
  );
  request.headers.set('X-Request-Id', requestId);
  const response = await orderAction({
    request,
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
  assert.equal(response.headers.get('X-Request-Id'), requestId);
});

test('Razorpay cart checkout reconciles Shopify discounts and preserves full-price carts', async () => {
  const originalFetch = globalThis.fetch;
  const razorpayPayloads: Record<string, unknown>[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== 'https://api.razorpay.com/v1/orders') {
      throw new Error(`Unexpected request: ${String(input)}`);
    }
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    razorpayPayloads.push(payload);
    return Response.json({
      id: `order_${razorpayPayloads.length}`,
      amount: payload.amount,
    });
  }) as typeof fetch;

  try {
    const scenarios = [
      {
        cartTotal: '1400.00',
        couponCode: 'SAVE100',
        amount: 140_000,
        lineItems: [
          {offer_price: 46_667, quantity: 1},
          {offer_price: 46_666, quantity: 1},
          {offer_price: 46_667, quantity: 1},
        ],
      },
      {
        cartTotal: '1500.00',
        couponCode: null,
        amount: 150_000,
        lineItems: [
          {offer_price: 50_000, quantity: 2},
          {offer_price: 50_000, quantity: 1},
        ],
      },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const session = new Map<string, unknown>();
      const form = new URLSearchParams({
        source: 'cart',
        products: JSON.stringify([
          {variantId: 'gid://shopify/ProductVariant/12345', quantity: 2},
          {variantId: 'gid://shopify/ProductVariant/12346', quantity: 1},
        ]),
      });
      if (scenario.couponCode) form.set('couponCode', scenario.couponCode);

      const response = await orderAction({
        request: formRequest('/api/checkout/razorpay/order', form),
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
          cart: {
            get: async () => ({
              id: 'gid://shopify/Cart/discounted',
              lines: {
                nodes: [
                  {
                    id: 'gid://shopify/CartLine/1',
                    quantity: 2,
                    cost: {
                      totalAmount: {amount: '1000.00', currencyCode: 'INR'},
                      amountPerQuantity: {amount: '500.00', currencyCode: 'INR'},
                    },
                    merchandise: {
                      id: 'gid://shopify/ProductVariant/12345',
                      title: 'Default Title',
                      compareAtPrice: null,
                      image: null,
                      product: {
                        id: 'gid://shopify/Product/1',
                        title: 'Test Tea',
                        handle: 'test-tea',
                      },
                    },
                  },
                  {
                    id: 'gid://shopify/CartLine/2',
                    quantity: 1,
                    cost: {
                      totalAmount: {amount: '500.00', currencyCode: 'INR'},
                      amountPerQuantity: {amount: '500.00', currencyCode: 'INR'},
                    },
                    merchandise: {
                      id: 'gid://shopify/ProductVariant/12346',
                      title: 'Default Title',
                      compareAtPrice: null,
                      image: null,
                      product: {
                        id: 'gid://shopify/Product/2',
                        title: 'Second Tea',
                        handle: 'second-tea',
                      },
                    },
                  },
                ],
              },
              cost: {
                subtotalAmount: {amount: '1500.00', currencyCode: 'INR'},
                totalAmount: {
                  amount: scenario.cartTotal,
                  currencyCode: 'INR',
                },
              },
              attributes: [],
              discountCodes: scenario.couponCode
                ? [{code: scenario.couponCode, applicable: true}]
                : [],
              appliedGiftCards: [],
            }),
          },
          session: {
            set: (key: string, value: unknown) => session.set(key, value),
            unset: (key: string) => session.delete(key),
          },
        },
      } as unknown as ActionFunctionArgs);

      const payload = razorpayPayloads[index];
      const lineItems = payload.line_items as Array<{
        offer_price: number;
        quantity: number;
      }>;
      assert.equal(response.status, 200);
      assert.equal(session.get('razorpayOrderId'), `order_${index + 1}`);
      assert.equal(payload.amount, scenario.amount);
      assert.equal(payload.line_items_total, scenario.amount);
      assert.deepEqual(
        lineItems.map(({offer_price, quantity}) => ({offer_price, quantity})),
        scenario.lineItems,
      );
      assert.equal(
        (payload.notes as Record<string, unknown>).coupon,
        scenario.couponCode ?? undefined,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Razorpay does not locally stack qualified discounts and uses Shopify final total', async () => {
  const originalFetch = globalThis.fetch;
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.razorpay.com/v1/orders');
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({id: 'order_mixed', amount: payload.amount});
  }) as typeof fetch;

  try {
    const products = [
      {variantId: 'gid://shopify/ProductVariant/101', quantity: 3},
      {variantId: 'gid://shopify/ProductVariant/202', quantity: 2},
      {variantId: 'gid://shopify/ProductVariant/303', quantity: 1},
      {variantId: 'gid://shopify/ProductVariant/404', quantity: 1},
    ];
    const line = (id: string, productId: string, quantity: number, total: string) => ({
      id: `gid://shopify/CartLine/${id}`,
      quantity,
      cost: {
        totalAmount: {amount: total, currencyCode: 'INR'},
        amountPerQuantity: {
          amount: (Number(total) / quantity).toFixed(2),
          currencyCode: 'INR',
        },
      },
      merchandise: {
        id: `gid://shopify/ProductVariant/${id}`,
        title: 'Default Title',
        compareAtPrice: null,
        image: null,
        product: {
          id: `gid://shopify/Product/${productId}`,
          title: `Tea ${productId}`,
          handle: `tea-${productId}`,
        },
      },
    });
    const form = new URLSearchParams({
      source: 'cart',
      products: JSON.stringify(products),
    });
    const response = await orderAction({
      request: formRequest('/api/checkout/razorpay/order', form),
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
        cart: {
          get: async () => ({
            id: 'gid://shopify/Cart/mixed',
            lines: {
              nodes: [
                // Both the 10% and 20% conditions may be met, but Shopify has
                // applied only the winning 20% Matcha discount to these totals.
                line('101', '1', 3, '1656.00'),
                line('202', '2', 2, '898.00'),
                line('303', '3', 1, '359.00'),
                line('404', '4', 1, '299.00'),
              ],
            },
            cost: {
              subtotalAmount: {amount: '3626.00', currencyCode: 'INR'},
              totalAmount: {amount: '3212.00', currencyCode: 'INR'},
            },
            attributes: [],
            discountCodes: [],
            appliedGiftCards: [],
          }),
        },
        session: {set() {}, unset() {}},
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 200);
    assert.ok(payload);
    assert.equal(payload.amount, 321_200);
    assert.equal(payload.line_items_total, 321_200);
    const lineItems = payload.line_items as Array<{
      offer_price: number;
      quantity: number;
    }>;
    assert.equal(
      lineItems.reduce((sum, item) => sum + item.offer_price * item.quantity, 0),
      321_200,
    );
    assert.notEqual(payload.amount, 279_800, 'must not add a local 10% discount');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Razorpay cart checkout fails closed for stale carts and unchargeable Shopify totals', async () => {
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = (async () => {
    externalCalls += 1;
    throw new Error('Razorpay must not be called');
  }) as typeof fetch;
  const baseContext = (totalAmount: string) => ({
    env: {
      CHECKOUT_PROVIDER: 'razorpay',
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    },
    cart: {
      get: async () => ({
        id: 'gid://shopify/Cart/fail-closed',
        lines: {
          nodes: [
            {
              id: 'gid://shopify/CartLine/1',
              quantity: 1,
              cost: {
                totalAmount: {amount: '500.00', currencyCode: 'INR'},
                amountPerQuantity: {amount: '500.00', currencyCode: 'INR'},
              },
              merchandise: {
                id: 'gid://shopify/ProductVariant/111',
                title: 'Default Title',
                compareAtPrice: null,
                image: null,
                product: {
                  id: 'gid://shopify/Product/1',
                  title: 'Tea',
                  handle: 'tea',
                },
              },
            },
          ],
        },
        cost: {
          subtotalAmount: {amount: '500.00', currencyCode: 'INR'},
          totalAmount: {amount: totalAmount, currencyCode: 'INR'},
        },
        attributes: [],
        discountCodes: [],
        appliedGiftCards: [],
      }),
    },
    session: {set() {}, unset() {}},
  });

  try {
    const staleResponse = await orderAction({
      request: formRequest(
        '/api/checkout/razorpay/order',
        new URLSearchParams({
          source: 'cart',
          products: JSON.stringify([
            {variantId: 'gid://shopify/ProductVariant/999', quantity: 1},
          ]),
        }),
      ),
      params: {},
      context: baseContext('500.00'),
    } as unknown as ActionFunctionArgs);
    assert.equal(staleResponse.status, 409);

    for (const total of ['0.00', '600.00']) {
      const response = await orderAction({
        request: formRequest(
          '/api/checkout/razorpay/order',
          new URLSearchParams({
            source: 'cart',
            products: JSON.stringify([
              {variantId: 'gid://shopify/ProductVariant/111', quantity: 1},
            ]),
          }),
        ),
        params: {},
        context: baseContext(total),
      } as unknown as ActionFunctionArgs);
      assert.equal(response.status, 502);
    }
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('Razorpay verification is unchanged when monitoring throws', async () => {
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
      session: {get: () => 'order_created_on_server'},
      monitor: {
        count() {
          throw new Error('Sentry unavailable');
        },
        failure() {
          throw new Error('Sentry unavailable');
        },
      },
    },
  } as unknown as ActionFunctionArgs);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error: 'Invalid payment verification'});
  assert.match(String(response.headers.get('X-Request-Id')), /^[0-9a-f-]{36}$/i);
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
      metaPurchase: {
        currency: 'INR',
        eventId: `meta_purchase_${orderId}`,
        items: [{id: '12345', itemPrice: 1, quantity: 1}],
        orderId: '#1018',
        value: 1,
      },
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
