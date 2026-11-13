import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abandonedRazorpayOrderId,
  parseDocumentedAbandonedRazorpayPayload,
  updateDocumentedAbandonedRazorpayDraft,
  updateAbandonedRazorpayDraft,
} from '../app/lib/checkout/providers/razorpay/razorpay-abandoned.server.ts';

test('extracts an order id from a Magic Checkout abandonment payload', () => {
  assert.equal(
    abandonedRazorpayOrderId({
      payload: {order: {entity: {id: 'order_TzWVdMNwzJNgCm'}}},
    }),
    'order_TzWVdMNwzJNgCm',
  );
});

test('extracts an order id from a failed-payment shaped payload', () => {
  assert.equal(
    abandonedRazorpayOrderId({
      payload: {payment: {entity: {order_id: 'order_TwBGA5mQDPMtX0'}}},
    }),
    'order_TwBGA5mQDPMtX0',
  );
});

test('rejects an invalid order anchor in the webhook payload', () => {
  assert.equal(abandonedRazorpayOrderId({order_id: 'draft_123'}), null);
});

test('parses the published Razorpay abandoned-cart payload without an order id', () => {
  const payload = {
      shop_id: 'magic-checkout-test-store-1',
      platform: 'shopify',
      token: 'a9de14647f2c1e7b58cafeac93c4712c',
      cart_token: 'c1-68be3bdc331cfec1e79d05d8c4caa7d7',
      email: 'buyer@example.com',
      phone: '+919999999999',
      currency: 'INR',
      line_items: [
        {variant_id: '43306810998951', quantity: 1, price: 5000},
      ],
      line_items_total: '5000',
      customer: {
        email: 'buyer@example.com',
        Shipping_address: {
          First_name: 'Gaurav',
          Last_name: 'Kumar',
          Address1: 'Near Nehru Road',
          City: 'Bengaluru',
          Province: 'Karnataka',
          Country_code: 'IN',
          Zip: '829122',
          Phone: '+919999999999',
        },
      },
    };
  assert.equal(abandonedRazorpayOrderId(payload), null);
  const parsed = parseDocumentedAbandonedRazorpayPayload(payload);
  assert.equal(parsed?.cartToken, 'c1-68be3bdc331cfec1e79d05d8c4caa7d7');
  assert.deepEqual(parsed?.lineItems, [{variantId: '43306810998951', quantity: 1}]);
  assert.equal(parsed?.shippingAddress?.countryCode, 'IN');
});

test('documented payload updates one exact open draft and persists correlation tokens', async () => {
  const operations: string[] = [];
  let updateInput: Record<string, unknown> | undefined;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: {input?: Record<string, unknown>};
    };
    operations.push(body.query);
    if (body.query.includes('query MatchAbandonedRazorpayDraft')) {
      return Response.json({
        data: {
          draftOrders: {
            nodes: [
              {
                id: 'gid://shopify/DraftOrder/1066559701089',
                status: 'OPEN',
                order: null,
                customAttributes: [{key: 'checkout_source', value: 'product'}],
                totalLineItemsPriceSet: {
                  presentmentMoney: {amount: '220.00', currencyCode: 'INR'},
                },
                lineItems: {
                  nodes: [
                    {
                      variant: {id: 'gid://shopify/ProductVariant/50294796484705'},
                      quantity: 1,
                    },
                  ],
                  pageInfo: {hasNextPage: false},
                },
              },
            ],
            pageInfo: {hasNextPage: false},
          },
        },
      });
    }
    if (body.query.includes('mutation UpdateDocumentedAbandonedRazorpayDraft')) {
      updateInput = body.variables.input;
      return Response.json({
        data: {
          draftOrderUpdate: {
            draftOrder: {
              id: 'gid://shopify/DraftOrder/1066559701089',
              status: 'OPEN',
              order: null,
            },
            userErrors: [],
          },
        },
      });
    }
    if (body.query.includes('mutation TagDocumentedAbandonedRazorpayDraft')) {
      return Response.json({
        data: {
          tagsAdd: {
            node: {id: 'gid://shopify/DraftOrder/1066559701089'},
            userErrors: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await updateDocumentedAbandonedRazorpayDraft({
    env: {
      PUBLIC_STORE_DOMAIN: 'documented-payload.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    payload: {
      token: 'a9de14647f2c1e7b58cafeac93c4712c',
      cart_token: 'c1-68be3bdc331cfec1e79d05d8c4caa7d7',
      email: 'wizatul1@gmail.com',
      phone: '+919002048910',
      currency: 'INR',
      line_items: [{variant_id: '50294796484705', quantity: 1}],
      line_items_total: '22000',
      customer: {
        email: 'wizatul1@gmail.com',
        Shipping_address: {
          First_name: 'Atul',
          Last_name: 'Dey',
          Address1: 'Hhgh',
          Address2: 'Jhgh',
          City: 'Jalgaon',
          Province: 'Maharashtra',
          Country_code: 'IN',
          Zip: '425507',
          Phone: '+919002048910',
        },
      },
    },
    now: new Date('2026-11-13T12:00:00.000Z'),
    fetcher,
  });

  assert.equal(result.updated, true);
  assert.equal(operations.length, 3);
  assert.equal(updateInput?.email, 'wizatul1@gmail.com');
  assert.equal(updateInput?.phone, '+919002048910');
  assert.equal(
    (updateInput?.customAttributes as Array<{key: string; value: string}>).some(
      ({key, value}) =>
        key === 'razorpay_cart_token' &&
        value === 'c1-68be3bdc331cfec1e79d05d8c4caa7d7',
    ),
    true,
  );
  assert.equal(operations.some((query) => query.includes('draftOrderComplete')), false);
});

test('updates only the anchored open draft for a zero-attempt abandoned order', async () => {
  const operations: string[] = [];
  let updateInput: Record<string, unknown> | undefined;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.razorpay.com/v1/orders/order_TzWVdMNwzJNgCm') {
      return Response.json({
        id: 'order_TzWVdMNwzJNgCm',
        amount: 25000,
        amount_due: 25000,
        amount_paid: 0,
        attempts: 0,
        currency: 'INR',
        status: 'created',
        line_items_total: 22000,
        shipping_fee: 3000,
        cod_fee: 0,
        notes: {
          items_0: '50294796484705:1:22000',
          shopify_draft_order_id: 'gid://shopify/DraftOrder/1066559701089',
          source: 'product',
        },
        customer_details: {
          contact: '+919002048910',
          email: 'wizatul1@gmail.com',
          shipping_address: {
            name: 'Atul Dey',
            line1: 'Hhgh',
            line2: 'Jhgh',
            city: 'Jalgaon',
            state: 'Maharashtra',
            zipcode: '425507',
            country: 'in',
            contact: '+919002048910',
          },
          billing_address: {
            name: 'Atul Dey',
            line1: 'Hhgh',
            line2: 'Jhgh',
            city: 'Jalgaon',
            state: 'Maharashtra',
            zipcode: '425507',
            country: 'in',
            contact: '+919002048910',
          },
        },
      });
    }
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: {input?: Record<string, unknown>};
    };
    operations.push(body.query);
    if (body.query.includes('query AbandonedRazorpayDraft')) {
      return Response.json({
        data: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/1066559701089',
            status: 'OPEN',
            order: null,
            customAttributes: [{key: 'merchant_reference', value: 'keep-me'}],
          },
        },
      });
    }
    if (body.query.includes('mutation UpdateAbandonedRazorpayDraft')) {
      updateInput = body.variables.input;
      return Response.json({
        data: {
          draftOrderUpdate: {
            draftOrder: {
              id: 'gid://shopify/DraftOrder/1066559701089',
              status: 'OPEN',
              order: null,
            },
            userErrors: [],
          },
        },
      });
    }
    if (body.query.includes('mutation TagAbandonedRazorpayDraft')) {
      return Response.json({
        data: {
          tagsAdd: {
            node: {id: 'gid://shopify/DraftOrder/1066559701089'},
            userErrors: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await updateAbandonedRazorpayDraft({
    env: {
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      PUBLIC_STORE_DOMAIN: 'abandoned-open.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    orderId: 'order_TzWVdMNwzJNgCm',
    eventId: 'event_abandoned_1',
    fetcher,
  });

  assert.equal(result.updated, true);
  assert.equal(result.draftOrderId, 'gid://shopify/DraftOrder/1066559701089');
  assert.equal(operations.length, 3);
  assert.equal(operations.some((query) => query.includes('draftOrderComplete')), false);
  assert.equal(operations.some((query) => query.includes('draftOrderDelete')), false);
  assert.equal(operations.some((query) => query.includes('orderCreate')), false);
  assert.equal(updateInput?.email, 'wizatul1@gmail.com');
  assert.equal(updateInput?.phone, '+919002048910');
  assert.equal('tags' in (updateInput ?? {}), false);
  assert.equal('note' in (updateInput ?? {}), false);
  assert.deepEqual(updateInput?.customAttributes, [
    {key: 'merchant_reference', value: 'keep-me'},
    {key: 'checkout_provider', value: 'razorpay'},
    {key: 'checkout_source', value: 'product'},
    {key: 'razorpay_order_id', value: 'order_TzWVdMNwzJNgCm'},
    {key: 'razorpay_abandonment_event_id', value: 'event_abandoned_1'},
  ]);
  assert.equal(
    (updateInput?.shippingLine as {priceWithCurrency: {amount: string}})
      .priceWithCurrency.amount,
    '30.00',
  );
});

test('a late abandonment callback never mutates a completed draft', async () => {
  const operations: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.razorpay.com/v1/orders/order_TwBGA5mQDPMtX0') {
      return Response.json({
        id: 'order_TwBGA5mQDPMtX0',
        amount: 43000,
        amount_due: 43000,
        amount_paid: 0,
        currency: 'INR',
        status: 'attempted',
        line_items_total: 43000,
        shipping_fee: 0,
        cod_fee: 0,
        notes: {
          items_0: '46604499681377:1:43000',
          shopify_draft_order_id: 'gid://shopify/DraftOrder/1065803841633',
          source: 'product',
        },
      });
    }
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const body = JSON.parse(String(init?.body)) as {query: string};
    operations.push(body.query);
    if (body.query.includes('query AbandonedRazorpayDraft')) {
      return Response.json({
        data: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/1065803841633',
            status: 'COMPLETED',
            order: {id: 'gid://shopify/Order/1'},
            customAttributes: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await updateAbandonedRazorpayDraft({
    env: {
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      PUBLIC_STORE_DOMAIN: 'abandoned-complete.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    orderId: 'order_TwBGA5mQDPMtX0',
    fetcher,
  });

  assert.equal(result.updated, false);
  assert.equal(operations.length, 1);
  assert.equal(operations.some((query) => query.includes('mutation')), false);
});
