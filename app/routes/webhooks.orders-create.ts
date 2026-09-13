import {type ActionFunctionArgs} from 'react-router';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

async function validSignature(body: string, signature: string | null) {
  if (!signature || !process.env.SHOPIFY_WEBHOOK_SECRET) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SHOPIFY_WEBHOOK_SECRET),
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

/**
 * Transitional no-op for deliveries already in flight. The orders/create
 * subscription has been removed and this route performs no Admin API writes.
 */
export async function action({request}: ActionFunctionArgs) {
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
    ))
  ) {
    return new Response('Unauthorized', {status: 401});
  }

  const topic = request.headers.get('x-shopify-topic');
  if (topic && topic !== 'orders/create') {
    return new Response('Unexpected webhook topic', {status: 400});
  }

  return new Response(null, {status: 200});
}
