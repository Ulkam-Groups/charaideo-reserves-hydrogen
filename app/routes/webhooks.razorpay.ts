import type {ActionFunctionArgs} from 'react-router';
import {reconcileRazorpayOrder} from '~/lib/checkout/providers/razorpay/razorpay-order.server';
import {verifyRazorpayWebhook} from '~/lib/checkout/providers/razorpay/razorpay.server';
import {
  isRazorpayReconciliationEvent,
  razorpayWebhookTarget,
} from '~/lib/checkout/providers/razorpay/razorpay';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;
const WEBHOOK_EVENT_TTL_SECONDS = 48 * 60 * 60;

function webhookEventCacheKey(eventId: string | null) {
  return eventId && /^[A-Za-z0-9_-]{1,200}$/.test(eventId)
    ? new Request(
        `https://razorpay-webhook-events.internal/${encodeURIComponent(eventId)}`,
      )
    : null;
}

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
  if (!(await verifyRazorpayWebhook(rawBody, signature, secret))) {
    return new Response('Unauthorized', {status: 401});
  }
  const eventCacheKey = webhookEventCacheKey(
    request.headers.get('x-razorpay-event-id')?.trim() ?? null,
  );
  if (eventCacheKey) {
    try {
      if (await context.reviewsCache.match(eventCacheKey)) {
        return new Response(null, {status: 200});
      }
    } catch {
      // Event-ID caching is a retry guard; sourceIdentifier lookup remains the fallback.
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', {status: 400});
  }
  const target = razorpayWebhookTarget(payload);
  if (!target) {
    return isRazorpayReconciliationEvent(payload)
      ? new Response('Invalid event payload', {status: 400})
      : new Response(null, {status: 204});
  }

  try {
    await reconcileRazorpayOrder({...target, env: context.env});
    if (eventCacheKey) {
      try {
        await context.reviewsCache.put(
          eventCacheKey,
          new Response(null, {
            headers: {
              'Cache-Control': `public, max-age=${WEBHOOK_EVENT_TTL_SECONDS}`,
            },
          }),
        );
      } catch {
        // A cache failure must not make Razorpay retry a completed reconciliation.
      }
    }
    return new Response(null, {status: 200});
  } catch (error) {
    context.monitor?.failure('checkout.razorpay.webhook.failure', {}, error);
    return new Response('Reconciliation failed', {status: 500});
  }
}
