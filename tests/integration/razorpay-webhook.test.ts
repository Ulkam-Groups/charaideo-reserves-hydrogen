import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import type {ActionFunctionArgs} from 'react-router';
import {action} from '../../app/routes/webhooks.razorpay.ts';

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
