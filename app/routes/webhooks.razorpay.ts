import type {ActionFunctionArgs} from 'react-router';
import {reconcileRazorpayOrder} from '~/lib/checkout/providers/razorpay/razorpay-order.server';
import {verifyRazorpayWebhook} from '~/lib/checkout/providers/razorpay/razorpay.server';
import {razorpayWebhookTarget} from '~/lib/checkout/providers/razorpay/razorpay';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {Allow: 'POST'},
    });
  }
  const secret = context.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get('x-razorpay-signature');
  if (!secret || !signature) return new Response('Unauthorized', {status: 401});
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return new Response('Payload too large', {status: 413});
  }
  if (!verifyRazorpayWebhook(rawBody, signature, secret)) {
    return new Response('Unauthorized', {status: 401});
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', {status: 400});
  }
  const target = razorpayWebhookTarget(payload);
  if (!target) return new Response(null, {status: 204});

  try {
    await reconcileRazorpayOrder({...target, env: context.env});
    return new Response(null, {status: 200});
  } catch (error) {
    context.monitor?.failure('checkout.razorpay.webhook.failure', {}, error);
    return new Response('Reconciliation failed', {status: 500});
  }
}
