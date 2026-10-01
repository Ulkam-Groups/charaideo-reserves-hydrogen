import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
  buildRazorpayMagicOrder,
  canStartRazorpayCheckout,
  decodeRazorpayCheckoutSnapshot,
  encodeRazorpayCheckoutSnapshot,
  inrToPaise,
  isRazorpayPrepaidShadowEvent,
  isRazorpayReconciliationEvent,
  parseRazorpayCheckoutProducts,
  razorpayPaidWebhookTarget,
  razorpayWebhookTarget,
  type RazorpayOrderLine,
} from '../app/lib/checkout/providers/razorpay/razorpay.ts';
import {startRazorpayCheckout} from '../app/lib/checkout/providers/razorpay/razorpay.client.ts';
import {
  createRazorpayDraftOrderAnchor,
  completeRazorpayDraftOrder,
  createShopifyOrder,
  buildRazorpayDraftOrderFinalInput,
  buildShopifyOrderInput,
  deleteRazorpayDraftOrderAnchor,
  razorpayDraftOrderAnchorEnabled,
  RazorpayReconciliationError,
  razorpayOrderIntegrationReady,
  razorpayVerificationFailureCode,
  retryPendingRazorpayFinalization,
  validateCapturedRazorpayPayment,
  validateRazorpayOrderForShopify,
  type RazorpayMagicOrderDetails,
  type RazorpayPaymentDetails,
} from '../app/lib/checkout/providers/razorpay/razorpay-order.server.ts';
import {
  classifyRazorpayFailure,
  createRazorpayMagicOrder,
  verifyRazorpayPayment,
  verifyRazorpayWebhook,
} from '../app/lib/checkout/providers/razorpay/razorpay.server.ts';
import {RAZORPAY_CSP} from '../app/lib/checkout/providers/razorpay/razorpay.config.ts';

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

test('Razorpay CSP permits checkout risk detection without broad script access', () => {
  assert.deepEqual(RAZORPAY_CSP.scriptSrc, [
    'https://checkout.razorpay.com',
    'https://cdn.razorpay.com',
    'https://checkout-static-next.razorpay.com',
  ]);
});

test('Razorpay order service uses the Oxygen fetch adapter', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  let rawInput: RequestInfo | URL | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    rawInput = input;
    request = input instanceof Request ? input : new Request(input, init);
    return Response.json({id: 'order_fetch123', amount: 49900});
  }) as typeof fetch;

  try {
    const result = await createRazorpayMagicOrder({
      credentials: {keyId: 'rzp_test_public', keySecret: 'test-secret'},
      source: 'product',
      expectedAmount: 49900,
      lines: [
        {
          variantId: 'gid://shopify/ProductVariant/12345',
          productId: 'gid://shopify/Product/987',
          sku: 'MATCHA-30',
          quantity: 1,
          unitPrice: '499.00',
          currencyCode: 'INR',
          name: 'Matcha - 30g',
          description: 'Matcha',
        },
      ],
    });

    assert.equal(result.id, 'order_fetch123');
    assert.equal(typeof rawInput, 'string');
    assert.equal(request?.url, 'https://api.razorpay.com/v1/orders');
    assert.equal(request?.method, 'POST');
    assert.match(request?.headers.get('authorization') ?? '', /^Basic /);
    const payload = (await request?.clone().json()) as Record<string, unknown>;
    assert.match(String(payload.receipt), /^cr_[a-z0-9]+_[0-9a-f]{8}$/);
    delete payload.receipt;
    assert.deepEqual(payload, {
      amount: 49900,
      currency: 'INR',
      line_items_total: 49900,
      line_items: [
        {
          sku: 'MATCHA-30',
          variant_id: '12345',
          price: 49900,
          offer_price: 49900,
          quantity: 1,
          name: 'Matcha - 30g',
          description: 'Matcha',
        },
      ],
      notes: {
        source: 'product',
        items_0: '12345:1:49900',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Razorpay API failures expose only safe operational classifications', () => {
  assert.deepEqual(
    classifyRazorpayFailure({
      statusCode: 400,
      error: {code: 'BAD_REQUEST_ERROR', description: 'private provider detail'},
    }),
    {
      code: 'RAZORPAY_ORDER_REJECTED',
      tags: {
        provider: 'razorpay',
        reason: 'order_rejected',
        upstreamStatus: 400,
        providerCode: 'BAD_REQUEST_ERROR',
      },
    },
  );
  assert.deepEqual(classifyRazorpayFailure(new TypeError('fetch failed')), {
    code: 'RAZORPAY_RUNTIME_FAILURE',
    tags: {provider: 'razorpay', reason: 'runtime'},
  });
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

test('Razorpay client waits for the deferred checkout script after navigation', async () => {
  const script = new EventTarget();
  const originalFetch = globalThis.fetch;
  let opened = false;
  Object.assign(globalThis, {
    fetch: async () =>
      Response.json({
        keyId: 'rzp_test_public',
        orderId: 'order_deferred',
        businessName: 'Charaideo Reserves',
      }),
    window: {
      location: {assign() {}},
      dispatchEvent() {},
    },
    document: {
      querySelector: () => script,
    },
  });

  try {
    const launch = startRazorpayCheckout({
      source: 'product',
      products: [{variantId: 'gid://shopify/ProductVariant/12345', quantity: 1}],
    });
    await Promise.resolve();
    Object.assign((globalThis as any).window, {
      Razorpay: class {
        on() {}
        open() {
          opened = true;
        }
      },
    });
    script.dispatchEvent(new Event('load'));

    assert.equal(await launch, true);
    assert.equal(opened, true);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'document');
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
  assert.equal('sourceName' in input, false);
  assert.equal('fulfillmentStatus' in input, false);
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

test('Razorpay signatures and webhook event targets are verified', async () => {
  const secret = 'test_secret';
  const orderId = 'order_abc123';
  const paymentId = 'pay_abc123';
  const paymentSignature = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  assert.equal(
    await verifyRazorpayPayment({
      credentials: {keyId: 'rzp_test_public', keySecret: secret},
      orderId,
      paymentId,
      signature: paymentSignature,
    }),
    true,
  );
  assert.equal(
    await verifyRazorpayPayment({
      credentials: {keyId: 'rzp_test_public', keySecret: secret},
      orderId,
      paymentId,
      signature: '0'.repeat(64),
    }),
    false,
  );

  const rawBody = JSON.stringify({event: 'order.paid'});
  const webhookSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
  assert.equal(await verifyRazorpayWebhook(rawBody, webhookSignature, secret), true);
  assert.equal(
    await verifyRazorpayWebhook(`${rawBody} `, webhookSignature, secret),
    false,
  );
  assert.deepEqual(
    razorpayWebhookTarget({
      event: 'payment.captured',
      payload: {payment: {entity: {id: paymentId, order_id: orderId}}},
    }),
    null,
  );
  assert.equal(isRazorpayPrepaidShadowEvent({event: 'order.paid'}), true);
  assert.deepEqual(
    razorpayPaidWebhookTarget({
      event: 'order.paid',
      payload: {
        order: {entity: {id: orderId}},
        payment: {entity: {id: paymentId, order_id: orderId}},
      },
    }),
    {orderId, paymentId},
  );
  assert.equal(
    razorpayPaidWebhookTarget({
      event: 'order.paid',
      payload: {
        order: {entity: {id: orderId}},
        payment: {entity: {id: paymentId, order_id: 'order_different'}},
      },
    }),
    null,
  );
  assert.deepEqual(
    razorpayWebhookTarget({
      event: 'order.paid',
      payload: {order: {entity: {id: orderId}}},
    }),
    null,
  );
  assert.deepEqual(
    razorpayWebhookTarget({
      event: 'order.placed',
      payload: {order: {entity: {id: orderId}}},
    }),
    {orderId},
  );
  assert.equal(razorpayWebhookTarget({event: 'refund.processed'}), null);
  assert.equal(isRazorpayReconciliationEvent({event: 'order.paid'}), false);
  assert.equal(isRazorpayReconciliationEvent({event: 'payment.captured'}), false);
  assert.equal(isRazorpayReconciliationEvent({event: 'refund.processed'}), false);
});

test('Razorpay verification retries only while payment finalization is pending', async () => {
  let attempts = 0;
  const waits: number[] = [];
  const result = await retryPendingRazorpayFinalization(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new RazorpayReconciliationError('Razorpay payment is not captured');
      }
      return 'ready';
    },
    async (milliseconds) => {
      waits.push(milliseconds);
    },
  );
  assert.equal(result, 'ready');
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [250, 750]);

  let permanentAttempts = 0;
  await assert.rejects(() =>
    retryPendingRazorpayFinalization(
      async () => {
        permanentAttempts += 1;
        throw new RazorpayReconciliationError('Shopify authentication failed');
      },
      async () => {},
    ),
  );
  assert.equal(permanentAttempts, 1);
  assert.equal(
    razorpayVerificationFailureCode(
      new RazorpayReconciliationError('Razorpay payment is not captured'),
    ),
    'RAZORPAY_PAYMENT_NOT_FINAL',
  );
  assert.equal(
    razorpayVerificationFailureCode(
      new RazorpayReconciliationError('Shopify authentication failed'),
    ),
    'SHOPIFY_ORDER_WRITE_FAILED',
  );
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
      PUBLIC_STORE_DOMAIN: 'http://127.0.0.1:4174',
      SHOPIFY_ADMIN_STORE_DOMAIN: 'store.myshopify.com',
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
  assert.equal(calls[0].url, 'https://store.myshopify.com/admin/oauth/access_token');
  const lookup = JSON.parse(String(calls[1].init?.body)) as {variables: {query: string}};
  assert.equal(lookup.variables.query, `source_identifier:${magicOrder.id}`);
  const mutation = JSON.parse(String(calls[3].init?.body)) as {
    variables: {order: {sourceIdentifier: string}};
  };
  assert.equal(mutation.variables.order.sourceIdentifier, magicOrder.id);
});

test('Razorpay draft anchor is opt-in and creates an uncompleted Shopify draft', async () => {
  assert.equal(razorpayDraftOrderAnchorEnabled({} as Env), false);
  assert.equal(
    razorpayDraftOrderAnchorEnabled({
      RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: ' true ',
    } as Env),
    true,
  );

  const calls: Array<{url: string; init?: RequestInit}> = [];
  const responses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({
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
    }),
  ];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    return responses.shift()!;
  }) as typeof fetch;

  const draft = await createRazorpayDraftOrderAnchor({
    env: {
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    lines: [orderLine],
    source: 'product',
    fetcher,
  });

  assert.deepEqual(draft, {
    id: 'gid://shopify/DraftOrder/123',
    name: '#D1',
    status: 'OPEN',
  });
  const request = JSON.parse(String(calls[1].init?.body)) as {
    query: string;
    variables: {
      input: {
        lineItems: Array<{
          variantId: string;
          quantity: number;
          priceOverride: {amount: string; currencyCode: string};
        }>;
        tags: string[];
        visibleToCustomer: boolean;
      };
    };
  };
  assert.match(request.query, /draftOrderCreate/);
  assert.deepEqual(request.variables.input.lineItems, [
    {
      variantId: orderLine.variantId,
      quantity: 2,
      priceOverride: {amount: '499.00', currencyCode: 'INR'},
    },
  ]);
  assert.deepEqual(request.variables.input.tags, [
    'razorpay',
    'magic-checkout',
    'checkout-draft',
  ]);
  assert.equal(request.variables.input.visibleToCustomer, false);
});

test('Razorpay draft finalization adds verified delivery and payment metadata', () => {
  const input = buildRazorpayDraftOrderFinalInput({
    order: {...magicOrder, notes: {...magicOrder.notes, source: 'product'}},
    payment: capturedPayment,
  });

  assert.equal(input.shippingAddress.countryCode, 'IN');
  assert.equal(input.shippingLine?.priceWithCurrency.amount, '10.00');
  assert.equal(input.shippingLine?.priceWithCurrency.currencyCode, 'INR');
  assert.deepEqual(input.tags, ['razorpay', 'magic-checkout', 'prepaid']);
  assert.deepEqual(input.customAttributes, [
    {key: 'checkout_provider', value: 'razorpay'},
    {key: 'checkout_source', value: 'product'},
    {key: 'razorpay_order_id', value: magicOrder.id},
    {key: 'razorpay_payment_id', value: capturedPayment.id},
    {key: 'razorpay_payment_method', value: 'upi'},
  ]);
});

test('Razorpay draft completion updates, total-checks and completes one Shopify order', async () => {
  const queries: string[] = [];
  let updateInput: Record<string, unknown> | undefined;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const request = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    queries.push(request.query);
    if (request.query.includes('query RazorpayDraftOrder')) {
      return Response.json({
        data: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/123',
            status: 'OPEN',
            totalPriceSet: {
              presentmentMoney: {amount: '998.00', currencyCode: 'INR'},
            },
            order: null,
          },
        },
      });
    }
    if (request.query.includes('mutation UpdateRazorpayDraftOrder')) {
      updateInput = request.variables.input as Record<string, unknown>;
      return Response.json({
        data: {
          draftOrderUpdate: {
            draftOrder: {
              id: 'gid://shopify/DraftOrder/123',
              status: 'OPEN',
              totalPriceSet: {
                presentmentMoney: {amount: '1008.00', currencyCode: 'INR'},
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
              id: 'gid://shopify/DraftOrder/123',
              status: 'COMPLETED',
              order: {id: 'gid://shopify/Order/1016', name: '#1016'},
            },
            userErrors: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await completeRazorpayDraftOrder({
    env: {
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    draftOrderId: 'gid://shopify/DraftOrder/123',
    order: {...magicOrder, notes: {...magicOrder.notes, source: 'product'}},
    payment: capturedPayment,
    fetcher,
  });

  assert.deepEqual(result, {
    id: 'gid://shopify/Order/1016',
    name: '#1016',
    created: true,
  });
  assert.equal(queries.length, 3);
  assert.equal(
    queries.some((query) => query.includes('orderCreate')),
    false,
  );
  assert.equal(
    (updateInput?.shippingLine as {priceWithCurrency: {amount: string}}).priceWithCurrency
      .amount,
    '10.00',
  );
});

test('Razorpay draft completion fails closed when Shopify recalculates a different total', async () => {
  const operations: string[] = [];
  let draftQueries = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const request = JSON.parse(String(init?.body)) as {query: string};
    operations.push(request.query);
    if (request.query.includes('query RazorpayDraftOrder')) {
      draftQueries += 1;
      return Response.json({
        data: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/123',
            status: 'OPEN',
            totalPriceSet: {
              presentmentMoney: {amount: '998.00', currencyCode: 'INR'},
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
              id: 'gid://shopify/DraftOrder/123',
              status: 'OPEN',
              totalPriceSet: {
                presentmentMoney: {amount: '1007.99', currencyCode: 'INR'},
              },
              order: null,
            },
            userErrors: [],
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  await assert.rejects(
    () =>
      completeRazorpayDraftOrder({
        env: {
          PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
          SHOPIFY_ADMIN_CLIENT_ID: 'client',
          SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
        } as Env,
        draftOrderId: 'gid://shopify/DraftOrder/123',
        order: magicOrder,
        payment: capturedPayment,
        fetcher,
      }),
    /Shopify rejected the Razorpay draft order/,
  );
  assert.equal(draftQueries, 1);
  assert.equal(
    operations.some((operation) =>
      operation.includes('mutation CompleteRazorpayDraftOrder'),
    ),
    false,
  );
});

test('Razorpay draft completion replay returns the order already attached to the draft', async () => {
  let graphqlCalls = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    graphqlCalls += 1;
    return Response.json({
      data: {
        draftOrder: {
          id: 'gid://shopify/DraftOrder/123',
          status: 'COMPLETED',
          totalPriceSet: {
            presentmentMoney: {amount: '1008.00', currencyCode: 'INR'},
          },
          order: {id: 'gid://shopify/Order/1016', name: '#1016'},
        },
      },
    });
  }) as typeof fetch;

  const result = await completeRazorpayDraftOrder({
    env: {
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    draftOrderId: 'gid://shopify/DraftOrder/123',
    order: magicOrder,
    payment: capturedPayment,
    fetcher,
  });

  assert.deepEqual(result, {
    id: 'gid://shopify/Order/1016',
    name: '#1016',
    created: false,
  });
  assert.equal(graphqlCalls, 1);
});

test('Razorpay draft completion recovers when the mutation response is lost', async () => {
  let draftQueries = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/admin/oauth/access_token')) {
      return Response.json({access_token: 'admin-token'});
    }
    const request = JSON.parse(String(init?.body)) as {query: string};
    if (request.query.includes('query RazorpayDraftOrder')) {
      draftQueries += 1;
      return Response.json({
        data: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/123',
            status: draftQueries === 1 ? 'OPEN' : 'COMPLETED',
            totalPriceSet: {
              presentmentMoney: {amount: '1008.00', currencyCode: 'INR'},
            },
            order:
              draftQueries === 1 ? null : {id: 'gid://shopify/Order/1016', name: '#1016'},
          },
        },
      });
    }
    if (request.query.includes('mutation UpdateRazorpayDraftOrder')) {
      return Response.json({
        data: {
          draftOrderUpdate: {
            draftOrder: {
              id: 'gid://shopify/DraftOrder/123',
              status: 'OPEN',
              totalPriceSet: {
                presentmentMoney: {amount: '1008.00', currencyCode: 'INR'},
              },
              order: null,
            },
            userErrors: [],
          },
        },
      });
    }
    if (request.query.includes('mutation CompleteRazorpayDraftOrder')) {
      throw new TypeError('connection closed after mutation');
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await completeRazorpayDraftOrder({
    env: {
      PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
    } as Env,
    draftOrderId: 'gid://shopify/DraftOrder/123',
    order: magicOrder,
    payment: capturedPayment,
    fetcher,
  });

  assert.deepEqual(result, {
    id: 'gid://shopify/Order/1016',
    name: '#1016',
    created: false,
  });
  assert.equal(draftQueries, 2);
});

test('Razorpay draft anchor cleanup deletes only a valid draft GID', async () => {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const responses = [
    Response.json({access_token: 'admin-token'}),
    Response.json({
      data: {
        draftOrderDelete: {
          deletedId: 'gid://shopify/DraftOrder/123',
          userErrors: [],
        },
      },
    }),
  ];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    return responses.shift()!;
  }) as typeof fetch;
  const env = {
    PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
    SHOPIFY_ADMIN_CLIENT_ID: 'client',
    SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
  } as Env;

  assert.equal(
    await deleteRazorpayDraftOrderAnchor({
      env,
      draftOrderId: 'not-a-draft',
      fetcher,
    }),
    false,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    await deleteRazorpayDraftOrderAnchor({
      env,
      draftOrderId: 'gid://shopify/DraftOrder/123',
      fetcher,
    }),
    true,
  );
  const request = JSON.parse(String(calls[1].init?.body)) as {
    variables: {input: {id: string}};
  };
  assert.equal(request.variables.input.id, 'gid://shopify/DraftOrder/123');
});

test('Razorpay readiness accepts a separate canonical Admin store domain', () => {
  assert.equal(
    razorpayOrderIntegrationReady({
      PUBLIC_STORE_DOMAIN: 'http://127.0.0.1:4174',
      SHOPIFY_ADMIN_STORE_DOMAIN: 'store.myshopify.com',
      SHOPIFY_ADMIN_CLIENT_ID: 'client',
      SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
    } as Env),
    true,
  );
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
