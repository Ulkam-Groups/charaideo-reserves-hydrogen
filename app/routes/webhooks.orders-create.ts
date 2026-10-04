import {type ActionFunctionArgs} from 'react-router';
import {
  metaPurchaseFromShopifyOrder,
  sendMetaServerEvent,
} from '../lib/ads/meta/meta-pixel.ts';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

async function validSignature(
  body: string,
  signature: string | null,
  secret: string | undefined,
) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const expectedBytes = new TextEncoder().encode(expected);
  const signatureBytes = new TextEncoder().encode(signature);
  if (expectedBytes.length !== signatureBytes.length) return false;
  return (
    expectedBytes.reduce(
      (result, byte, index) => result | (byte ^ signatureBytes[index]),
      0,
    ) === 0
  );
}

/** Receives Fastrr-created Shopify orders and reports consented purchases to Meta. */
export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {Allow: 'POST'},
    });
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }
  if (
    !(await validSignature(
      body,
      request.headers.get('x-shopify-hmac-sha256'),
      context.env.SHOPIFY_WEBHOOK_SECRET?.trim(),
    ))
  ) {
    return new Response('Unauthorized', {status: 401});
  }

  const topic = request.headers.get('x-shopify-topic');
  if (topic !== 'orders/create' && topic !== 'orders/paid') {
    return new Response('Unexpected webhook topic', {status: 400});
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', {status: 400});
  }

  const event = await metaPurchaseFromShopifyOrder(payload, topic);
  if (!event) return new Response(null, {status: 204});

  try {
    await sendMetaServerEvent(context.env, event);
    return new Response(null, {status: 204});
  } catch (error) {
    context.monitor?.failure(
      'meta.capi.purchase.failure',
      {topic, provider: 'fastrr'},
      error,
    );
    console.error(
      JSON.stringify({
        level: 'error',
        scope: 'meta.capi.purchase',
        topic,
        requestId: context.requestId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    // A 5xx asks Shopify to retry. The stable Meta event_id deduplicates a
    // response that was accepted by Meta but interrupted before acknowledgement.
    return new Response('Meta delivery failed', {status: 502});
  }
}
