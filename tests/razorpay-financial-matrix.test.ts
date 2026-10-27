import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileRazorpayOrder,
  RazorpayReconciliationError,
  type RazorpayMagicOrderDetails,
  type RazorpayPaymentDetails,
  validateCapturedRazorpayPayment,
  validatePendingRazorpayCodPayment,
  validateRazorpayOrderForShopify,
} from '../app/lib/checkout/providers/razorpay/razorpay-order.server.ts';

const LINE_TOTAL = 44_900;
const ADVANCE = 10_000;

type FinancialScenario = {
  name: string;
  state: 'prepaid' | 'cod' | 'partial-cod';
  shippingFee: number;
  codFee: number;
  expectedFinancialStatus?: 'PENDING' | 'PARTIALLY_PAID';
  expectedTag: 'prepaid' | 'cod' | 'partial-cod';
};

const scenarios: FinancialScenario[] = [
  {
    name: 'prepaid with free shipping',
    state: 'prepaid',
    shippingFee: 0,
    codFee: 0,
    expectedTag: 'prepaid',
  },
  {
    name: 'prepaid with charged shipping',
    state: 'prepaid',
    shippingFee: 6_000,
    codFee: 0,
    expectedTag: 'prepaid',
  },
  {
    name: 'COD with free shipping',
    state: 'cod',
    shippingFee: 0,
    codFee: 0,
    expectedFinancialStatus: 'PENDING',
    expectedTag: 'cod',
  },
  {
    name: 'COD with charged shipping',
    state: 'cod',
    shippingFee: 7_000,
    codFee: 0,
    expectedFinancialStatus: 'PENDING',
    expectedTag: 'cod',
  },
  {
    name: 'charged COD with free shipping',
    state: 'cod',
    shippingFee: 0,
    codFee: 10_000,
    expectedFinancialStatus: 'PENDING',
    expectedTag: 'cod',
  },
  {
    name: 'charged COD with charged shipping',
    state: 'cod',
    shippingFee: 7_000,
    codFee: 7_000,
    expectedFinancialStatus: 'PENDING',
    expectedTag: 'cod',
  },
  {
    name: 'partial COD with free shipping',
    state: 'partial-cod',
    shippingFee: 0,
    codFee: 0,
    expectedFinancialStatus: 'PARTIALLY_PAID',
    expectedTag: 'partial-cod',
  },
  {
    name: 'partial COD with charged shipping',
    state: 'partial-cod',
    shippingFee: 6_000,
    codFee: 0,
    expectedFinancialStatus: 'PARTIALLY_PAID',
    expectedTag: 'partial-cod',
  },
  {
    name: 'partial charged COD with charged shipping',
    state: 'partial-cod',
    shippingFee: 6_000,
    codFee: 7_000,
    expectedFinancialStatus: 'PARTIALLY_PAID',
    expectedTag: 'partial-cod',
  },
];

function razorpayOrder(scenario: FinancialScenario): RazorpayMagicOrderDetails {
  const amount = LINE_TOTAL + scenario.shippingFee;
  const amountPaid =
    scenario.state === 'prepaid'
      ? amount
      : scenario.state === 'partial-cod'
        ? ADVANCE
        : 0;
  return {
    id: `order_${scenario.name.replace(/[^a-z]/gi, '')}`,
    amount,
    amount_paid: amountPaid,
    amount_due: amount - amountPaid,
    currency: 'INR',
    status:
      scenario.state === 'prepaid'
        ? 'paid'
        : scenario.state === 'partial-cod'
          ? 'attempted'
          : 'placed',
    line_items_total: LINE_TOTAL,
    shipping_fee: scenario.shippingFee,
    cod_fee: scenario.codFee,
    notes: {items_0: '12345:1:44900'},
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
  };
}

function capturedPayment(order: RazorpayMagicOrderDetails): RazorpayPaymentDetails {
  return {
    id: `pay_${order.id.slice('order_'.length)}`,
    order_id: order.id,
    amount: order.amount_paid,
    currency: 'INR',
    status: 'captured',
    captured: true,
    method: 'upi',
  };
}

function pendingCodPayment(order: RazorpayMagicOrderDetails): RazorpayPaymentDetails {
  return {
    id: `pay_${order.id.slice('order_'.length)}`,
    order_id: order.id,
    amount: order.amount + (order.cod_fee ?? 0),
    currency: 'INR',
    status: 'pending',
    captured: false,
    method: 'cod',
  };
}

function mockFinancialApis(
  order: RazorpayMagicOrderDetails,
  payment: RazorpayPaymentDetails | null,
) {
  const shopifyInputs: Array<Record<string, unknown>> = [];
  let orderCreateCalls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === `https://api.razorpay.com/v1/orders/${order.id}`) {
      return Response.json(order);
    }
    if (payment && url === `https://api.razorpay.com/v1/payments/${payment.id}`) {
      return Response.json(payment);
    }
    if (payment && url === `https://api.razorpay.com/v1/orders/${order.id}/payments`) {
      return Response.json({entity: 'collection', count: 1, items: [payment]});
    }
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token', scope: 'write_orders'});
    }
    if (url.includes('/admin/api/2026-07/graphql.json')) {
      const request = JSON.parse(String(init?.body)) as {
        query: string;
        variables: {order?: Record<string, unknown>};
      };
      if (request.query.includes('query RazorpayExistingOrder')) {
        return Response.json({data: {orders: {nodes: []}}});
      }
      if (request.query.includes('mutation CreateRazorpayOrder')) {
        orderCreateCalls += 1;
        shopifyInputs.push(request.variables.order!);
        return Response.json({
          data: {
            orderCreate: {
              order: {id: 'gid://shopify/Order/1001', name: '#1001'},
              userErrors: [],
            },
          },
        });
      }
    }
    throw new Error(`Unexpected mocked API request: ${url}`);
  }) as typeof fetch;
  return {fetcher, shopifyInputs, orderCreateCalls: () => orderCreateCalls};
}

for (const scenario of scenarios) {
  test(`financial reconciliation: ${scenario.name}`, async () => {
    const order = razorpayOrder(scenario);
    const razorpayPayment =
      scenario.state === 'cod' ? pendingCodPayment(order) : capturedPayment(order);
    const payment = scenario.state === 'cod' ? null : razorpayPayment;
    const api = mockFinancialApis(order, razorpayPayment);
    const result = await reconcileRazorpayOrder({
      env: {
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'razorpay-secret',
        PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
        SHOPIFY_ADMIN_CLIENT_ID: 'client',
        SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      } as Env,
      orderId: order.id,
      paymentId: razorpayPayment.id,
      fetcher: api.fetcher,
    });

    assert.equal(result.shopifyOrder.created, true);
    assert.equal(api.orderCreateCalls(), 1);
    assert.equal(api.shopifyInputs.length, 1);
    const shopify = api.shopifyInputs[0] as {
      financialStatus?: string;
      tags: string[];
      shippingLines?: Array<{priceSet: {shopMoney: {amount: string}}}>;
      transactions?: Array<{amountSet: {shopMoney: {amount: string}}}>;
      customAttributes: Array<{key: string; value: string}>;
    };
    assert.equal(shopify.financialStatus, scenario.expectedFinancialStatus);
    assert.equal(shopify.tags.includes(scenario.expectedTag), true);
    const extraFees = scenario.shippingFee + scenario.codFee;
    assert.equal(
      shopify.shippingLines?.[0]?.priceSet.shopMoney.amount,
      extraFees ? (extraFees / 100).toFixed(2) : undefined,
    );
    assert.equal(
      shopify.transactions?.[0]?.amountSet.shopMoney.amount,
      payment ? (payment.amount / 100).toFixed(2) : undefined,
    );
    if (scenario.state === 'partial-cod') {
      const attributes = Object.fromEntries(
        shopify.customAttributes.map(({key, value}) => [key, value]),
      );
      assert.equal(attributes.razorpay_partial_cod_paid, (ADVANCE / 100).toFixed(2));
      assert.equal(
        attributes.razorpay_partial_cod_due,
        ((order.amount_due + scenario.codFee) / 100).toFixed(2),
      );
    }
  });
}

for (const scenarioIndex of [5, 8]) {
  const scenario = scenarios[scenarioIndex];
  test(`anchored ${scenario.name} persists customer details before final order cleanup`, async () => {
    const order = razorpayOrder(scenario);
    const razorpayPayment =
      scenario.state === 'cod' ? pendingCodPayment(order) : capturedPayment(order);
    const draftOrderId = 'gid://shopify/DraftOrder/7001';
    order.notes.shopify_draft_order_id = draftOrderId;
    let draftUpdated = false;
    let draftDeleted = false;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === `https://api.razorpay.com/v1/orders/${order.id}`) {
        return Response.json(order);
      }
      if (url === `https://api.razorpay.com/v1/payments/${razorpayPayment.id}`) {
        return Response.json(razorpayPayment);
      }
      if (url.endsWith('/admin/oauth/access_token')) {
        return Response.json({
          access_token: 'admin-token',
          scope: 'write_orders,write_draft_orders',
        });
      }
      if (url.includes('/admin/api/2026-07/graphql.json')) {
        const request = JSON.parse(String(init?.body)) as {
          query: string;
          variables: Record<string, any>;
        };
        if (request.query.includes('mutation UpdateRazorpayDraftOrder')) {
          draftUpdated = true;
          assert.equal(request.variables.id, draftOrderId);
          assert.equal(request.variables.input.shippingAddress.address1, 'Tea Road');
          assert.equal(request.variables.input.billingAddress.address1, 'Tea Road');
          return Response.json({
            data: {
              draftOrderUpdate: {
                draftOrder: {
                  id: draftOrderId,
                  status: 'OPEN',
                  totalPriceSet: {
                    presentmentMoney: {
                      amount: ((order.amount + (order.cod_fee ?? 0)) / 100).toFixed(2),
                      currencyCode: 'INR',
                    },
                  },
                  shippingAddress: {address1: 'Tea Road'},
                  billingAddress: {address1: 'Tea Road'},
                  order: null,
                },
                userErrors: [],
              },
            },
          });
        }
        if (request.query.includes('query RazorpayExistingOrder')) {
          return Response.json({data: {orders: {nodes: []}}});
        }
        if (request.query.includes('mutation CreateRazorpayOrder')) {
          return Response.json({
            data: {
              orderCreate: {
                order: {
                  id: 'gid://shopify/Order/7001',
                  name: '#7001',
                  shippingAddress: {address1: 'Tea Road'},
                  billingAddress: {address1: 'Tea Road'},
                },
                userErrors: [],
              },
            },
          });
        }
        if (request.query.includes('mutation DeleteRazorpayDraftOrder')) {
          draftDeleted = true;
          return Response.json({
            data: {draftOrderDelete: {deletedId: draftOrderId, userErrors: []}},
          });
        }
      }
      throw new Error(`Unexpected mocked API request: ${url}`);
    }) as typeof fetch;

    const result = await reconcileRazorpayOrder({
      env: {
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'razorpay-secret',
        PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
        SHOPIFY_ADMIN_CLIENT_ID: `anchored-${scenarioIndex}`,
        SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
        RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
      } as Env,
      orderId: order.id,
      paymentId: razorpayPayment.id,
      draftOrderId,
      fetcher,
    });

    assert.equal(result.shopifyOrder.created, true);
    assert.equal(draftUpdated, true);
    assert.equal(draftDeleted, true);
  });
}

test('financial reconciliation fails closed for inconsistent Razorpay order totals', () => {
  const base = razorpayOrder(scenarios[5]);
  const invalidOrders: Array<[string, RazorpayMagicOrderDetails]> = [
    ['line item mismatch', {...base, line_items_total: LINE_TOTAL + 1}],
    ['order amount mismatch', {...base, amount: base.amount + 1}],
    ['foreign currency', {...base, currency: 'USD'}],
    ['negative shipping fee', {...base, shipping_fee: -1}],
    ['negative COD fee', {...base, cod_fee: -1}],
  ];
  for (const [name, order] of invalidOrders) {
    assert.throws(
      () => validateRazorpayOrderForShopify(order, order.id),
      RazorpayReconciliationError,
      name,
    );
  }
});

test('partial COD validation rejects inconsistent or untrusted captured payments', () => {
  const order = razorpayOrder(scenarios[7]);
  const payment = capturedPayment(order);
  const invalidPayments: Array<
    [string, RazorpayMagicOrderDetails, RazorpayPaymentDetails]
  > = [
    ['wrong payment amount', order, {...payment, amount: payment.amount - 1}],
    ['wrong order', order, {...payment, order_id: 'order_other'}],
    ['wrong currency', order, {...payment, currency: 'USD'}],
    ['not captured', order, {...payment, status: 'authorized', captured: false}],
    ['forged payment id', order, {...payment, id: 'invalid'}],
    ['invalid paid/due sum', {...order, amount_due: order.amount_due - 1}, payment],
    ['invalid partial state', {...order, status: 'placed'}, payment],
    [
      'zero advance',
      {...order, amount_paid: 0, amount_due: order.amount},
      {...payment, amount: 0},
    ],
  ];
  for (const [name, candidateOrder, candidatePayment] of invalidPayments) {
    assert.throws(
      () => validateCapturedRazorpayPayment(candidatePayment, candidateOrder),
      RazorpayReconciliationError,
      name,
    );
  }
});

test('COD validation rejects forged, captured, non-COD, and incorrectly charged payments', () => {
  const order = razorpayOrder(scenarios[5]);
  const payment = pendingCodPayment(order);
  assert.equal(validatePendingRazorpayCodPayment(payment, order).id, payment.id);
  const invalidPayments: Array<[string, RazorpayPaymentDetails]> = [
    ['wrong amount', {...payment, amount: payment.amount - 1}],
    ['missing COD fee', {...payment, amount: order.amount}],
    ['wrong order', {...payment, order_id: 'order_other'}],
    ['wrong currency', {...payment, currency: 'USD'}],
    ['captured COD', {...payment, status: 'captured', captured: true}],
    ['non-COD method', {...payment, method: 'upi'}],
    ['forged payment id', {...payment, id: 'invalid'}],
  ];
  for (const [name, candidate] of invalidPayments) {
    assert.throws(
      () => validatePendingRazorpayCodPayment(candidate, order),
      RazorpayReconciliationError,
      name,
    );
  }
});

test('COD reconciliation discovers and validates the pending payment when no payment id is supplied', async () => {
  const order = razorpayOrder(scenarios[4]);
  const payment = pendingCodPayment(order);
  const api = mockFinancialApis(order, payment);
  const result = await reconcileRazorpayOrder({
    env: {
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    orderId: order.id,
    fetcher: api.fetcher,
  });
  assert.equal(result.shopifyOrder.created, true);
  assert.equal(api.orderCreateCalls(), 1);
});

test('invalid COD payment from the API fails before any Shopify order mutation', async () => {
  const order = razorpayOrder(scenarios[5]);
  const payment = {...pendingCodPayment(order), amount: order.amount};
  const api = mockFinancialApis(order, payment);
  await assert.rejects(
    reconcileRazorpayOrder({
      env: {
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'razorpay-secret',
        PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
        SHOPIFY_ADMIN_CLIENT_ID: 'client',
        SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      } as Env,
      orderId: order.id,
      paymentId: payment.id,
      fetcher: api.fetcher,
    }),
    RazorpayReconciliationError,
  );
  assert.equal(api.orderCreateCalls(), 0);
});

test('duplicate Shopify lookup prevents a second financial order mutation', async () => {
  const order = razorpayOrder(scenarios[2]);
  const payment = pendingCodPayment(order);
  let orderCreateCalls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === `https://api.razorpay.com/v1/orders/${order.id}`) {
      return Response.json(order);
    }
    if (url === `https://api.razorpay.com/v1/payments/${payment.id}`) {
      return Response.json(payment);
    }
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token', scope: 'write_orders'});
    }
    if (url.includes('/admin/api/2026-07/graphql.json')) {
      const request = JSON.parse(String(init?.body)) as {query: string};
      if (request.query.includes('query RazorpayExistingOrder')) {
        return Response.json({
          data: {orders: {nodes: [{id: 'gid://shopify/Order/99', name: '#1099'}]}},
        });
      }
      if (request.query.includes('mutation CreateRazorpayOrder')) orderCreateCalls += 1;
    }
    throw new Error(`Unexpected mocked API request: ${url}`);
  }) as typeof fetch;

  const result = await reconcileRazorpayOrder({
    env: {
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    orderId: order.id,
    paymentId: payment.id,
    fetcher,
  });
  assert.equal(result.shopifyOrder.created, false);
  assert.equal(result.shopifyOrder.id, 'gid://shopify/Order/99');
  assert.equal(orderCreateCalls, 0);
});

test('Shopify financial rejection is surfaced and never reported as success', async () => {
  const order = razorpayOrder(scenarios[3]);
  const payment = pendingCodPayment(order);
  const api = mockFinancialApis(order, payment);
  const rejectingFetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/admin/api/2026-07/graphql.json')) {
      const request = JSON.parse(String(init?.body)) as {query: string};
      if (request.query.includes('mutation CreateRazorpayOrder')) {
        return Response.json({
          data: {
            orderCreate: {
              order: null,
              userErrors: [{field: ['order'], message: 'Financial status rejected'}],
            },
          },
        });
      }
    }
    return api.fetcher(input, init);
  }) as typeof fetch;

  await assert.rejects(
    reconcileRazorpayOrder({
      env: {
        RAZORPAY_KEY_ID: 'rzp_test_public',
        RAZORPAY_KEY_SECRET: 'razorpay-secret',
        PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
        SHOPIFY_ADMIN_CLIENT_ID: 'client',
        SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      } as Env,
      orderId: order.id,
      paymentId: payment.id,
      fetcher: rejectingFetcher,
    }),
    RazorpayReconciliationError,
  );
});
