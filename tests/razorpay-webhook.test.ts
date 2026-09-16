import test from 'node:test';
import assert from 'node:assert/strict';
import {action} from '../app/routes/webhooks.razorpay-test.ts';

const secret = 'test-webhook-secret';
const body = JSON.stringify({event: 'payment.captured'});

async function signatureFor(message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function send(message: string, signature?: string, configured = true) {
  const request = new Request('https://store.example/webhooks/razorpay-test', {
    method: 'POST',
    headers: signature ? {'x-razorpay-signature': signature} : {},
    body: message,
  });
  return action({request, context: {env: configured ? {RAZORPAY_WEBHOOK_SECRET: secret} : {}}} as never);
}

test('Razorpay test webhook verifies the unmodified raw body before acknowledging', async () => {
  const signature = await signatureFor(body);
  assert.equal((await send(body, signature)).status, 204);
  assert.equal((await send(body + ' ', signature)).status, 401);
  assert.equal((await send(body)).status, 401);
});

test('Razorpay test webhook stays unavailable without a configured secret', async () => {
  assert.equal((await send(body, await signatureFor(body), false)).status, 503);
});
