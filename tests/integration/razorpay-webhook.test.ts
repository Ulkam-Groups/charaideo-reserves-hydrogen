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
    [{event: 'order.paid', payload: {}}, 400],
    [{event: 'payment.captured', payload: {payment: {entity: {}}}}, 400],
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
