import type {ActionFunctionArgs} from 'react-router';
import {
  abandonedRazorpayOrderId,
  updateDocumentedAbandonedRazorpayDraft,
  updateAbandonedRazorpayDraft,
} from '~/lib/checkout/providers/razorpay/razorpay-abandoned.server';
import {verifyRazorpayWebhook} from '~/lib/checkout/providers/razorpay/razorpay.server';

const MAX_BODY_BYTES = 256_000;

export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}});
  }
  const secret = context.env.RAZORPAY_ABANDONED_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get('x-razorpay-signature');
  if (!secret || !signature) return new Response('Unauthorized', {status: 401});

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }
  if (!(await verifyRazorpayWebhook(rawBody, signature, secret))) {
    return new Response('Unauthorized', {status: 401});
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', {status: 400});
  }
  const orderId = abandonedRazorpayOrderId(payload);

  try {
    const eventId = request.headers.get('x-razorpay-event-id') ?? undefined;
    if (orderId) {
      await updateAbandonedRazorpayDraft({env: context.env, orderId, eventId});
    } else {
      await updateDocumentedAbandonedRazorpayDraft({
        env: context.env,
        payload,
        eventId,
      });
    }
    return new Response(null, {status: 204});
  } catch (error) {
    console.error('Unable to update abandoned Razorpay draft order', error);
    return new Response('Abandoned checkout update failed', {status: 500});
  }
}
