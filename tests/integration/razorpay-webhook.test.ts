import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import type {ActionFunctionArgs} from 'react-router';
import {action} from '../../app/routes/webhooks.razorpay.ts';
import {action as verifyAction} from '../../app/routes/api.checkout.razorpay.verify.ts';

function args(request: Request, secret = 'webhook-secret') {
  return {
    request,
    params: {},
    context: {
      env: {RAZORPAY_WEBHOOK_SECRET: secret},
      monitor: {failure() {}},
    },
  } as unknown as ActionFunctionArgs;
}

test('Razorpay webhook rejects unsupported methods and unsigned requests', async () => {
  const methodResponse = await action(
    args(new Request('https://store.example/webhooks/razorpay')),
  );
  assert.equal(methodResponse.status, 405);

  const unsignedResponse = await action(
    args(
      new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        body: '{}',
      }),
    ),
  );
  assert.equal(unsignedResponse.status, 401);
});

test('Razorpay webhook validates raw body and rejects oversized payloads', async () => {
  const secret = 'webhook-secret';
  const invalidJson = '{';
  const signature = createHmac('sha256', secret).update(invalidJson).digest('hex');
  const invalidResponse = await action(
    args(
      new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {'x-razorpay-signature': signature},
        body: invalidJson,
      }),
      secret,
    ),
  );
  assert.equal(invalidResponse.status, 400);

  const oversizedResponse = await action(
    args(
      new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'content-length': '1000001',
          'x-razorpay-signature': '0'.repeat(64),
        },
        body: '{}',
      }),
      secret,
    ),
  );
  assert.equal(oversizedResponse.status, 413);
});

test('Razorpay webhook rejects malformed reconciliation events but ignores unrelated events', async () => {
  const secret = 'webhook-secret';
  for (const [payload, expectedStatus] of [
    [{event: 'order.paid', payload: {}}, 204],
    [{event: 'payment.captured', payload: {payment: {entity: {}}}}, 204],
    [{event: 'order.placed', payload: {}}, 400],
    [{event: 'refund.processed', payload: {}}, 204],
  ] as const) {
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const response = await action(
      args(
        new Request('https://store.example/webhooks/razorpay', {
          method: 'POST',
          headers: {'x-razorpay-signature': signature},
          body: rawBody,
        }),
        secret,
      ),
    );
    assert.equal(response.status, expectedStatus);
  }
});

test('Razorpay order.paid shadow mode validates authoritative payment state without Shopify writes', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const secret = 'webhook-secret';
  const orderId = 'order_shadow123';
  const paymentId = 'pay_shadow123';
  const requests: string[] = [];
  let observation: Promise<unknown> | undefined;
  const metrics: Array<{
    name: string;
    tags?: Record<string, string | number | boolean>;
  }> = [];
  const payload = {
    event: 'order.paid',
    payload: {
      order: {entity: {id: orderId}},
      payment: {entity: {id: paymentId, order_id: orderId}},
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
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
          shopify_draft_order_id: 'gid://shopify/DraftOrder/123',
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
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  console.info = () => {};

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': 'event-shadow-123',
        },
        body: rawBody,
      }),
      params: {},
      context: {
        env: {
          RAZORPAY_WEBHOOK_SECRET: secret,
          RAZORPAY_WEBHOOK_SHADOW_ENABLED: 'true',
          RAZORPAY_KEY_ID: 'rzp_test_public',
          RAZORPAY_KEY_SECRET: 'key-secret',
        },
        monitor: {
          count(name: string, tags?: Record<string, string | number | boolean>) {
            metrics.push({name, tags});
          },
          duration() {},
          failure() {},
          flush() {},
        },
        waitUntil(promise: Promise<unknown>) {
          observation = promise;
        },
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 204);
    assert.ok(observation);
    await observation;
    assert.deepEqual(requests, [
      `https://api.razorpay.com/v1/orders/${orderId}`,
      `https://api.razorpay.com/v1/payments/${paymentId}`,
    ]);
    assert.equal(
      requests.some((url) => url.includes('myshopify.com')),
      false,
    );
    assert.deepEqual(metrics, [
      {
        name: 'checkout.razorpay.webhook.shadow',
        tags: {
          event: 'order.paid',
          outcome: 'eligible',
          eventIdPresent: true,
        },
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test('Razorpay order.paid shadow mode acknowledges invalid contracts without external writes', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const secret = 'webhook-secret';
  const metrics: Array<Record<string, string | number | boolean> | undefined> = [];
  const rawBody = JSON.stringify({
    event: 'order.paid',
    payload: {
      order: {entity: {id: 'order_shadow123'}},
      payment: {
        entity: {id: 'pay_shadow123', order_id: 'order_different'},
      },
    },
  });
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  globalThis.fetch = (async () => {
    throw new Error('Shadow payload validation must not call an external API');
  }) as typeof fetch;
  console.warn = () => {};

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {'x-razorpay-signature': signature},
        body: rawBody,
      }),
      params: {},
      context: {
        env: {
          RAZORPAY_WEBHOOK_SECRET: secret,
          RAZORPAY_WEBHOOK_SHADOW_ENABLED: 'true',
        },
        monitor: {
          count(_name: string, tags?: Record<string, string | number | boolean>) {
            metrics.push(tags);
          },
          duration() {},
          failure() {},
          flush() {},
        },
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 204);
    assert.deepEqual(metrics, [
      {
        event: 'order.paid',
        outcome: 'invalid_payload',
        eventIdPresent: false,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('Razorpay browser and recovery webhook complete one anchored order and replay is idempotent', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const origin = 'https://store.example';
  const webhookSecret = 'webhook-secret';
  const keySecret = 'razorpay-secret';
  const orderId = 'order_recovery123';
  const paymentId = 'pay_recovery123';
  const draftOrderId = 'gid://shopify/DraftOrder/123';
  const shopifyOrder = {id: 'gid://shopify/Order/1021', name: '#1021'};
  const session = new Map<string, unknown>([
    ['razorpayOrderId', orderId],
    ['razorpayDraftOrderId', draftOrderId],
  ]);
  const graphqlOperations: string[] = [];
  const outcomes: string[] = [];
  let draftCompleted = false;
  let completionMutations = 0;

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
      const request = JSON.parse(String(init?.body)) as {query: string};
      graphqlOperations.push(request.query);
      if (request.query.includes('query RazorpayDraftOrder')) {
        return Response.json({
          data: {
            draftOrder: {
              id: draftOrderId,
              status: draftCompleted ? 'COMPLETED' : 'OPEN',
              totalPriceSet: {
                presentmentMoney: {amount: '1.00', currencyCode: 'INR'},
              },
              order: draftCompleted ? shopifyOrder : null,
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
        completionMutations += 1;
        draftCompleted = true;
        return Response.json({
          data: {
            draftOrderComplete: {
              draftOrder: {
                id: draftOrderId,
                status: 'COMPLETED',
                order: shopifyOrder,
              },
              userErrors: [],
            },
          },
        });
      }
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  console.info = () => {};

  const env = {
    CHECKOUT_PROVIDER: 'razorpay',
    RAZORPAY_KEY_ID: 'rzp_test_public',
    RAZORPAY_KEY_SECRET: keySecret,
    RAZORPAY_WEBHOOK_SECRET: webhookSecret,
    RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
    RAZORPAY_WEBHOOK_RECOVERY_ENABLED: 'true',
    PUBLIC_STORE_DOMAIN: 'store.myshopify.com',
    SHOPIFY_ADMIN_CLIENT_ID: 'client',
    SHOPIFY_ADMIN_CLIENT_SECRET: 'secret',
  };
  const payload = {
    event: 'order.paid',
    payload: {
      order: {entity: {id: orderId}},
      payment: {entity: {id: paymentId, order_id: orderId}},
    },
  };
  const rawBody = JSON.stringify(payload);
  const webhookSignature = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const paymentSignature = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  function webhookRequest(eventId: string) {
    return action({
      request: new Request(`${origin}/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'x-razorpay-signature': webhookSignature,
          'x-razorpay-event-id': eventId,
        },
        body: rawBody,
      }),
      params: {},
      context: {
        env,
        monitor: {
          count(_name: string, tags?: Record<string, string | number | boolean>) {
            if (typeof tags?.outcome === 'string') outcomes.push(tags.outcome);
          },
          duration() {},
          failure() {},
          flush() {},
        },
      },
    } as unknown as ActionFunctionArgs);
  }

  try {
    const [browserResponse, webhookResponse] = await Promise.all([
      verifyAction({
        request: new Request(`${origin}/api/checkout/razorpay/verify`, {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: new URLSearchParams({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: paymentSignature,
          }),
        }),
        params: {},
        context: {
          env,
          session: {
            get: (key: string) => session.get(key),
            set: (key: string, value: unknown) => session.set(key, value),
            unset: (key: string) => session.delete(key),
          },
        },
      } as unknown as ActionFunctionArgs),
      webhookRequest('event-recovery-1'),
    ]);

    assert.equal(browserResponse.status, 200);
    assert.equal(webhookResponse.status, 204);
    assert.equal(completionMutations, 1);
    assert.deepEqual(session.get('razorpayPaymentVerified'), {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderName: shopifyOrder.name,
    });

    const replayResponse = await webhookRequest('event-recovery-2');
    assert.equal(replayResponse.status, 204);
    assert.equal(completionMutations, 1);
    assert.equal(
      graphqlOperations.some((operation) => operation.includes('orderCreate')),
      false,
    );
    assert.equal(outcomes.length, 2);
    assert.ok(outcomes[0] === 'completed' || outcomes[0] === 'already_completed');
    assert.equal(outcomes[1], 'already_completed');
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test('Razorpay recovery acknowledges an unanchored legacy order without Shopify writes', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const webhookSecret = 'webhook-secret';
  const orderId = 'order_noanchor123';
  const paymentId = 'pay_noanchor123';
  const requests: string[] = [];
  const payload = {
    event: 'order.paid',
    payload: {
      order: {entity: {id: orderId}},
      payment: {entity: {id: paymentId, order_id: orderId}},
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
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
        notes: {source: 'product', items_0: '12345:1:100'},
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
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  console.error = () => {};

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {'x-razorpay-signature': signature},
        body: rawBody,
      }),
      params: {},
      context: {
        env: {
          RAZORPAY_WEBHOOK_SECRET: webhookSecret,
          RAZORPAY_WEBHOOK_RECOVERY_ENABLED: 'true',
          RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
          RAZORPAY_KEY_ID: 'rzp_test_public',
          RAZORPAY_KEY_SECRET: 'key-secret',
        },
        monitor: {count() {}, duration() {}, failure() {}, flush() {}},
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 204);
    assert.equal(
      requests.some((url) => url.includes('myshopify.com')),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('Razorpay recovery fails before external calls when the draft feature is disabled', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const secret = 'webhook-secret';
  const rawBody = JSON.stringify({
    event: 'order.paid',
    payload: {
      order: {entity: {id: 'order_config123'}},
      payment: {
        entity: {id: 'pay_config123', order_id: 'order_config123'},
      },
    },
  });
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  globalThis.fetch = (async () => {
    throw new Error('Misconfigured recovery must not call an external API');
  }) as typeof fetch;
  console.error = () => {};

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {'x-razorpay-signature': signature},
        body: rawBody,
      }),
      params: {},
      context: {
        env: {
          RAZORPAY_WEBHOOK_SECRET: secret,
          RAZORPAY_WEBHOOK_RECOVERY_ENABLED: 'true',
        },
        monitor: {count() {}, duration() {}, failure() {}, flush() {}},
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('Razorpay recovery never promotes payment.captured to an order writer', async () => {
  const originalFetch = globalThis.fetch;
  const secret = 'webhook-secret';
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {id: 'pay_monitor123', order_id: 'order_monitor123'},
      },
    },
  });
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  globalThis.fetch = (async () => {
    throw new Error('payment.captured must remain read-only');
  }) as typeof fetch;

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/razorpay', {
        method: 'POST',
        headers: {'x-razorpay-signature': signature},
        body: rawBody,
      }),
      params: {},
      context: {
        env: {
          RAZORPAY_WEBHOOK_SECRET: secret,
          RAZORPAY_WEBHOOK_RECOVERY_ENABLED: 'true',
          RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED: 'true',
        },
        monitor: {count() {}, duration() {}, failure() {}, flush() {}},
      },
    } as unknown as ActionFunctionArgs);

    assert.equal(response.status, 204);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
