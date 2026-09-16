import type {Route} from './+types/webhooks.razorpay-test';
import {synchronizeConfirmedOrder} from '../lib/razorpay.server.ts';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

/** Signed webhook fallback for captured prepaid and placed COD orders. */
export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {Allow: 'POST'},
    });
  }

  const secret = context.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook unavailable', {status: 503});

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }

  const signature = request.headers.get('x-razorpay-signature');
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) {
    return new Response('Unauthorized', {status: 401});
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['verify'],
  );
  const signatureBytes = Uint8Array.from(
    signature.match(/.{2}/g)!,
    (pair) => Number.parseInt(pair, 16),
  );
  const verified = await crypto.subtle.verify('HMAC', key, signatureBytes, body);
  if (!verified) return new Response('Unauthorized', {status: 401});

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response('Invalid JSON', {status: 400});
  }

  if (!payload || typeof payload !== 'object' || !('event' in payload) || typeof payload.event !== 'string') {
    return new Response('Missing event', {status: 400});
  }

  if (payload.event === 'payment.captured' || payload.event === 'payment.pending') {
    const entity = (payload as {payload?: {payment?: {entity?: {id?: unknown; order_id?: unknown}}}}).payload?.payment?.entity;
    if (typeof entity?.id !== 'string' || typeof entity.order_id !== 'string') {
      return new Response('Missing payment', {status: 400});
    }
    try {
      await synchronizeConfirmedOrder(context.env, entity.order_id, entity.id);
    } catch (error) {
      console.error(JSON.stringify({scope: 'razorpay-webhook-sync', event: payload.event, eventId: request.headers.get('x-razorpay-event-id'), errorName: error instanceof Error ? error.name : 'UnknownError'}));
      return new Response('Order synchronization pending', {status: 503});
    }
  }

  // No customer or payment details are written to application logs.
  console.info(JSON.stringify({
    scope: 'razorpay-test-webhook',
    event: payload.event,
    eventId: request.headers.get('x-razorpay-event-id'),
  }));

  return new Response(null, {status: 204});
}
