import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

import {action} from '../app/routes/webhooks.orders-create.ts';

test('order webhook ignores a signed delivery without Fastrr consent metadata', async () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({id: 123, line_items: []});
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error('No network call is permitted from the retired webhook.');
  }) as typeof fetch;

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/orders-create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': signature,
          'x-shopify-topic': 'orders/create',
        },
        body,
      }),
      context: {
        env: {SHOPIFY_WEBHOOK_SECRET: secret},
        monitor: null,
        requestId: 'request-test',
      },
    } as never);

    assert.equal(response.status, 204);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('signed Fastrr paid-order webhook sends one consented Meta Purchase', async () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({
    id: 987654321,
    name: '#1042',
    created_at: '2026-10-04T10:00:00Z',
    currency: 'INR',
    total_price: '549.00',
    financial_status: 'paid',
    note_attributes: [
      {name: '__cr_checkout_provider', value: 'fastrr'},
      {name: '__cr_meta_consent', value: '1'},
      {name: '__cr_meta_fbp', value: 'fb.1.1720000000.123456789'},
    ],
    email: 'customer@example.com',
    line_items: [{variant_id: 12345, quantity: 2, price: '249.50'}],
  });
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  const originalFetch = globalThis.fetch;
  let metaRequest: Request | undefined;
  globalThis.fetch = (async (input, init) => {
    metaRequest = new Request(input, init);
    return new Response(JSON.stringify({events_received: 1}), {status: 200});
  }) as typeof fetch;

  try {
    const response = await action({
      request: new Request('https://store.example/webhooks/orders-create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': signature,
          'x-shopify-topic': 'orders/paid',
        },
        body,
      }),
      context: {
        env: {
          SHOPIFY_WEBHOOK_SECRET: secret,
          PUBLIC_META_PIXEL_ID: '1130857422791298',
          META_CONVERSIONS_API_ACCESS_TOKEN: 'server-only-test-token',
          META_GRAPH_API_VERSION: 'v24.0',
          META_TEST_EVENT_CODE: 'TEST123',
        },
        monitor: null,
        requestId: 'request-test',
      },
    } as never);

    assert.equal(response.status, 204);
    assert.ok(metaRequest);
    assert.equal(
      metaRequest.url,
      'https://graph.facebook.com/v24.0/1130857422791298/events',
    );
    assert.equal(
      metaRequest.headers.get('authorization'),
      'Bearer server-only-test-token',
    );
    const sent = (await metaRequest.json()) as {
      data: Array<{event_id: string; event_name: string}>;
      test_event_code: string;
    };
    assert.equal(sent.test_event_code, 'TEST123');
    assert.deepEqual(
      sent.data.map(({event_name, event_id}) => ({event_name, event_id})),
      [{event_name: 'Purchase', event_id: 'meta_purchase_shopify_987654321'}],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
