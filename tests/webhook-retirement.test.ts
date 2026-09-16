import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

import {action} from '../app/routes/webhooks.orders-create.ts';

test('retired order webhook acknowledges a signed delivery without API writes', async () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({id: 123, line_items: []});
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  process.env.SHOPIFY_WEBHOOK_SECRET = secret;
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
    } as never);

    assert.equal(response.status, 200);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) {
      delete process.env.SHOPIFY_WEBHOOK_SECRET;
    } else {
      process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
    }
  }
});
