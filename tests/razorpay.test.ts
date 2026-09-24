import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
  buildRazorpayMagicOrder,
  canStartRazorpayCheckout,
  decodeRazorpayCheckoutSnapshot,
  encodeRazorpayCheckoutSnapshot,
  inrToPaise,
  parseRazorpayCheckoutProducts,
  razorpayWebhookTarget,
  type RazorpayOrderLine,
} from '../app/lib/checkout/providers/razorpay/razorpay.ts';
import {startRazorpayCheckout} from '../app/lib/checkout/providers/razorpay/razorpay.client.ts';
import {
  createShopifyOrder,
  buildShopifyOrderInput,
  validateCapturedRazorpayPayment,
  validateRazorpayOrderForShopify,
  type RazorpayMagicOrderDetails,
  type RazorpayPaymentDetails,
} from '../app/lib/checkout/providers/razorpay/razorpay-order.server.ts';
import {
  verifyRazorpayPayment,
  verifyRazorpayWebhook,
} from '../app/lib/checkout/providers/razorpay/razorpay.server.ts';
import {
  buildRazorpayShippingResponse,
  parseRazorpayShippingAddresses,
} from '../app/lib/checkout/providers/razorpay/razorpay-shipping.server.ts';

test('Razorpay validates Shopify variants and converts INR to paise', () => {
  const products = [{variantId: 'gid://shopify/ProductVariant/12345', quantity: 2}];
  assert.equal(canStartRazorpayCheckout(products), true);
  assert.equal(canStartRazorpayCheckout([{variantId: 'bad', quantity: 1}]), false);
  assert.equal(inrToPaise('299.35'), 29935);
  assert.throws(() => inrToPaise('299.999'));

  const form = new FormData();
  form.set('products', JSON.stringify(products));
  assert.deepEqual(parseRazorpayCheckoutProducts(form.get('products')), products);
});

test('Razorpay Magic order contains authoritative line totals', () => {
  assert.deepEqual(
    buildRazorpayMagicOrder([
      {
        variantId: 'gid://shopify/ProductVariant/12345',
        productId: 'gid://shopify/Product/987',
        sku: 'MATCHA-30',
        quantity: 2,
        unitPrice: '499.00',
        compareAtPrice: '599.00',
        currencyCode: 'INR',
        name: 'Ceremonial Matcha - 30g',
        description: 'Assamica matcha',
        imageUrl: 'https://cdn.shopify.com/matcha.jpg',
        productUrl: 'https://example.com/products/matcha',
      },
    ]),
    {
      amount: 99800,
      lineItems: [
        {
          sku: 'MATCHA-30',
          variant_id: '12345',
          price: 59900,
          offer_price: 49900,
          quantity: 2,
          name: 'Ceremonial Matcha - 30g',
          description: 'Assamica matcha',
          image_url: 'https://cdn.shopify.com/matcha.jpg',
          product_url: 'https://example.com/products/matcha',
        },
      ],
    },
  );
});

test('Razorpay shipping requires an explicit fee and keeps COD opt-in', () => {
  const addresses = parseRazorpayShippingAddresses([
    {id: '0', zipcode: '786153', state_code: 'AS', country: 'IN'},
  ]);
  assert.ok(addresses);
  assert.deepEqual(
    buildRazorpayShippingResponse(addresses, {
      RAZORPAY_SHIPPING_FEE_PAISE: '0',
    } as Env),
    {
      addresses: [
        {
          id: '0',
          zipcode: '786153',
          state_code: 'AS',
          country: 'IN',
          shipping_methods: [
            {
              id: 'standard',
              description: 'Standard delivery',
              name: 'Standard delivery',
              serviceable: true,
              shipping_fee: 0,
              cod: false,
              cod_fee: 0,
            },
          ],
        },
      ],
    },
  );
});

test('Razorpay client creates an order before opening Magic Checkout', async () => {
  let opened = false;
  let options: Record<string, unknown> | undefined;
  let paymentFailed: (() => void) | undefined;
  let resolveRedirect!: (value: string) => void;
  const redirected = new Promise<string>((resolve) => {
    resolveRedirect = resolve;
  });
  const responses = [
    Response.json({
      keyId: 'rzp_test_public',
      orderId: 'order_123',
      businessName: 'Charaideo Reserves',
    }),
    Response.json({redirectTo: '/checkout/razorpay/success'}),
  ];
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    fetch: async () => responses.shift()!,
    window: {
      Razorpay: class {
        constructor(received: Record<string, unknown>) {
          options = received;
        }
        on(_event: string, handler: () => void) {
          paymentFailed = handler;
        }
        open() {
          opened = true;
        }
      },
      location: {assign: resolveRedirect},
      dispatchEvent() {},
    },
  });

  try {
    assert.equal(
      await startRazorpayCheckout({
        source: 'product',
        products: [{variantId: 'gid://shopify/ProductVariant/12345', quantity: 1}],
      }),
      true,
    );
    assert.equal(opened, true);
    assert.equal(options?.one_click_checkout, true);
    assert.equal(options?.order_id, 'order_123');
    assert.equal(options?.show_coupons, false);
    assert.equal(options?.name, 'Charaideo Reserves');
    assert.equal(typeof options?.handler, 'function');
    assert.equal(typeof paymentFailed, 'function');
    (options?.handler as (response: Record<string, string>) => void)({
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'a'.repeat(64),
    });
    assert.equal(await redirected, '/checkout/razorpay/success');
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'window');
  }
});

const orderLine: RazorpayOrderLine = {
  variantId: 'gid://shopify/ProductVariant/12345',
  productId: 'gid://shopify/Product/987',
  sku: 'MATCHA-30',
  quantity: 2,
  unitPrice: '499.00',
  currencyCode: 'INR',
  name: 'Ceremonial Matcha - 30g',
  description: 'Assamica matcha',
};

const magicOrder: RazorpayMagicOrderDetails = {
  id: 'order_abc123',
  amount: 100800,
  amount_paid: 100800,
  amount_due: 0,
  currency: 'INR',
  status: 'paid',
  line_items_total: 99800,
  shipping_fee: 1000,
  cod_fee: 0,
  notes: encodeRazorpayCheckoutSnapshot([orderLine]),
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

const capturedPayment: RazorpayPaymentDetails = {
  id: 'pay_abc123',
  order_id: magicOrder.id,
  amount: magicOrder.amount,
  currency: 'INR',
  status: 'captured',
  captured: true,
  method: 'upi',
};

test('Razorpay checkout snapshot round-trips and rejects tampering', () => {
  assert.deepEqual(decodeRazorpayCheckoutSnapshot(magicOrder.notes), [
    {
      variantId: orderLine.variantId,
      quantity: 2,
      unitPricePaise: 49900,
    },
  ]);
  assert.equal(decodeRazorpayCheckoutSnapshot({items_0: '12345:0:49900'}), null);
  assert.equal(decodeRazorpayCheckoutSnapshot({items_0: 'bad'}), null);
});

test('Razorpay final order and captured payment are validated before Shopify', () => {
  const validated = validateRazorpayOrderForShopify(magicOrder, magicOrder.id);
  assert.equal(validated.lines[0].unitPricePaise, 49900);
  assert.equal(
    validateCapturedRazorpayPayment(capturedPayment, magicOrder).id,
    'pay_abc123',
  );

  assert.throws(() =>
    validateRazorpayOrderForShopify(
      {...magicOrder, amount: magicOrder.amount + 1},
      magicOrder.id,
    ),
  );
  assert.throws(() =>
    validateCapturedRazorpayPayment(
      {...capturedPayment, status: 'authorized', captured: false},
      magicOrder,
    ),
  );
  assert.throws(() =>
    validateCapturedRazorpayPayment(
      {...capturedPayment, amount: capturedPayment.amount - 1},
      magicOrder,
    ),
  );
  assert.doesNotThrow(() =>
    validateRazorpayOrderForShopify(
      {
        ...magicOrder,
        status: 'placed',
        amount_paid: 0,
        amount_due: magicOrder.amount,
      },
      magicOrder.id,
    ),
  );
});

test('Shopify order input records payment, addresses, shipping and idempotency key', () => {
  const {lines} = validateRazorpayOrderForShopify(magicOrder, magicOrder.id);
  const input = buildShopifyOrderInput({
    order: magicOrder,
    lines,
    payment: capturedPayment,
    test: true,
  });
  assert.equal(input.sourceIdentifier, magicOrder.id);
  assert.equal(input.shippingAddress.countryCode, 'IN');
  assert.equal(input.shippingLines?.[0].priceSet.shopMoney.amount, '10.00');
  assert.equal('transactions' in input, true);
  if (!('transactions' in input)) throw new Error('Expected prepaid transaction');
  assert.equal(input.transactions[0].status, 'SUCCESS');
  assert.deepEqual(input.transactions[0].receiptJson, {
    razorpay_order_id: magicOrder.id,
    razorpay_payment_id: capturedPayment.id,
    method: 'upi',
  });

  const cod = buildShopifyOrderInput({
    order: {
      ...magicOrder,
      status: 'placed',
      amount_paid: 0,
      amount_due: magicOrder.amount,
    },
    lines,
    payment: null,
    test: false,
  });
  assert.equal('financialStatus' in cod && cod.financialStatus, 'PENDING');
  assert.equal('transactions' in cod, false);
});

test('Razorpay signatures and webhook event targets are verified', () => {
  const secret = 'test_secret';
  const orderId = 'order_abc123';
  const paymentId = 'pay_abc123';
  const paymentSignature = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  assert.equal(
    verifyRazorpayPayment({
      credentials: {keyId: 'rzp_test_public', keySecret: secret},
      orderId,
      paymentId,
      signature: paymentSignature,
    }),
    true,
  );
  assert.equal(
    verifyRazorpayPayment({
      credentials: {keyId: 'rzp_test_public', keySecret: secret},
      orderId,
      paymentId,
      signature: '0'.repeat(64),
    }),
    false,
  );

  const rawBody = JSON.stringify({event: 'order.paid'});
  const webhookSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
  assert.equal(verifyRazorpayWebhook(rawBody, webhookSignature, secret), true);
  assert.equal(verifyRazorpayWebhook(`${rawBody} `, webhookSignature, secret), false);
  assert.deepEqual(
    razorpayWebhookTarget({
      event: 'payment.captured',
      payload: {payment: {entity: {id: paymentId, order_id: orderId}}},
    }),
    {orderId, paymentId},
  );
  assert.deepEqual(
    razorpayWebhookTarget({
      event: 'order.placed',
      payload: {order: {entity: {id: orderId}}},
    }),
    {orderId},
  );
  assert.equal(razorpayWebhookTarget({event: 'refund.processed'}), null);
});

test('Shopify creation checks for an existing Razorpay order before mutation', async () => {
  const {lines} = validateRazorpayOrderForShopify(magicOrder, magicOrder.id);
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const responses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({data: {orders: {nodes: []}}}),
    Response.json({access_token: 'admin-token'}),
    Response.json({
      data: {
        orderCreate: {
          order: {id: 'gid://shopify/Order/1', name: '#1001'},
          userErrors: [],
        },
      },
    }),
  ];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    return responses.shift()!;
  }) as typeof fetch;
  const result = await createShopifyOrder(
    {
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
    } as Env,
    magicOrder,
    lines,
    capturedPayment,
    fetcher,
  );
  assert.deepEqual(result, {id: 'gid://shopify/Order/1', name: '#1001', created: true});
  const lookup = JSON.parse(String(calls[1].init?.body)) as {variables: {query: string}};
  assert.equal(lookup.variables.query, `source_identifier:${magicOrder.id}`);
  const mutation = JSON.parse(String(calls[3].init?.body)) as {
    variables: {order: {sourceIdentifier: string}};
  };
  assert.equal(mutation.variables.order.sourceIdentifier, magicOrder.id);
});

test('Shopify duplicate lookup skips order creation and user errors fail closed', async () => {
  const {lines} = validateRazorpayOrderForShopify(magicOrder, magicOrder.id);
  const env = {
    PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
    SHOPIFY_ADMIN_CLIENT_ID: 'client',
    SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    RAZORPAY_KEY_ID: 'rzp_live_public',
    RAZORPAY_KEY_SECRET: 'razorpay-secret',
  } as Env;
  const duplicateResponses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({
      data: {orders: {nodes: [{id: 'gid://shopify/Order/1', name: '#1001'}]}},
    }),
  ];
  const duplicate = await createShopifyOrder(
    env,
    magicOrder,
    lines,
    capturedPayment,
    (async () => duplicateResponses.shift()!) as typeof fetch,
  );
  assert.equal(duplicate.created, false);

  const rejectedResponses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({data: {orders: {nodes: []}}}),
    Response.json({access_token: 'admin-token'}),
    Response.json({
      data: {
        orderCreate: {
          order: null,
          userErrors: [{field: ['order'], message: 'Rejected'}],
        },
      },
    }),
  ];
  await assert.rejects(() =>
    createShopifyOrder(env, magicOrder, lines, capturedPayment, (async () =>
      rejectedResponses.shift()!) as typeof fetch),
  );

  const graphqlErrorResponses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({errors: [{message: 'Access denied'}]}),
  ];
  await assert.rejects(() =>
    createShopifyOrder(env, magicOrder, lines, capturedPayment, (async () =>
      graphqlErrorResponses.shift()!) as typeof fetch),
  );
});
