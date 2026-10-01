import type {ActionFunctionArgs} from 'react-router';
import {
  inspectRazorpayPrepaidOrder,
  razorpayDraftOrderAnchorEnabled,
  razorpayVerificationFailureCode,
  reconcileRazorpayOrder,
  retryPendingRazorpayFinalization,
} from '~/lib/checkout/providers/razorpay/razorpay-order.server';
import {verifyRazorpayWebhook} from '~/lib/checkout/providers/razorpay/razorpay.server';
import {
  isRazorpayPrepaidShadowEvent,
  isRazorpayReconciliationEvent,
  razorpayPaidWebhookTarget,
  razorpayWebhookTarget,
} from '~/lib/checkout/providers/razorpay/razorpay';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

function shadowEnabled(env: Env) {
  return env.RAZORPAY_WEBHOOK_SHADOW_ENABLED?.trim().toLowerCase() === 'true';
}

function recoveryEnabled(env: Env) {
  return env.RAZORPAY_WEBHOOK_RECOVERY_ENABLED?.trim().toLowerCase() === 'true';
}

async function safeCorrelation(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
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

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', {status: 400});
  }

  if (isRazorpayPrepaidShadowEvent(payload)) {
    const target = razorpayPaidWebhookTarget(payload);
    const eventIdPresent = Boolean(request.headers.get('x-razorpay-event-id'));
    if (recoveryEnabled(context.env)) {
      if (!target) return new Response('Invalid event payload', {status: 400});

      const correlation = await safeCorrelation(target.orderId);
      if (!razorpayDraftOrderAnchorEnabled(context.env)) {
        const code = 'RAZORPAY_WEBHOOK_RECOVERY_MISCONFIGURED';
        context.monitor?.failure(
          'checkout.razorpay.webhook.recovery.failure',
          {event: 'order.paid', code, eventIdPresent},
          new Error(code),
        );
        console.error('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: 'failed',
          code,
          eventIdPresent,
          correlation,
        });
        return new Response('Recovery is not configured', {status: 503});
      }
      try {
        const {shopifyOrder} = await retryPendingRazorpayFinalization(() =>
          reconcileRazorpayOrder({
            ...target,
            env: context.env,
            requireDraftOrderAnchor: true,
          }),
        );
        context.monitor?.count('checkout.razorpay.webhook.recovery', {
          event: 'order.paid',
          outcome: shopifyOrder.created ? 'completed' : 'already_completed',
          eventIdPresent,
        });
        console.info('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: shopifyOrder.created ? 'completed' : 'already_completed',
          eventIdPresent,
          correlation,
        });
        return new Response(null, {status: 204});
      } catch (error) {
        const code = razorpayVerificationFailureCode(error);
        const retryable = code !== 'RAZORPAY_ORDER_DATA_INVALID';
        context.monitor?.failure(
          'checkout.razorpay.webhook.recovery.failure',
          {event: 'order.paid', code, eventIdPresent},
          error,
        );
        console.error('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: retryable ? 'failed' : 'ineligible',
          code,
          eventIdPresent,
          correlation,
        });
        return retryable
          ? new Response('Reconciliation failed', {status: 500})
          : new Response(null, {status: 204});
      }
    }

    if (!shadowEnabled(context.env)) return new Response(null, {status: 204});

    if (!target) {
      context.monitor?.count('checkout.razorpay.webhook.shadow', {
        event: 'order.paid',
        outcome: 'invalid_payload',
        eventIdPresent,
      });
      console.warn('Razorpay webhook shadow observation', {
        event: 'order.paid',
        outcome: 'invalid_payload',
        eventIdPresent,
      });
      return new Response(null, {status: 204});
    }

    const observe = async () => {
      let correlation = 'unavailable';
      try {
        correlation = await safeCorrelation(target.orderId);
        await inspectRazorpayPrepaidOrder({...target, env: context.env});
        context.monitor?.count('checkout.razorpay.webhook.shadow', {
          event: 'order.paid',
          outcome: 'eligible',
          eventIdPresent,
        });
        console.info('Razorpay webhook shadow observation', {
          event: 'order.paid',
          outcome: 'eligible',
          eventIdPresent,
          correlation,
        });
      } catch (error) {
        const code = razorpayVerificationFailureCode(error);
        context.monitor?.failure(
          'checkout.razorpay.webhook.shadow.failure',
          {event: 'order.paid', code, eventIdPresent},
          error,
        );
        console.warn('Razorpay webhook shadow observation', {
          event: 'order.paid',
          outcome: 'ineligible',
          code,
          eventIdPresent,
          correlation,
        });
      }
    };
    const observation = observe();
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(observation);
    } else {
      await observation;
    }
    return new Response(null, {status: 204});
  }

  const target = razorpayWebhookTarget(payload);
  if (!target) {
    return isRazorpayReconciliationEvent(payload)
      ? new Response('Invalid event payload', {status: 400})
      : new Response(null, {status: 204});
  }

  try {
    await reconcileRazorpayOrder({...target, env: context.env});
    return new Response(null, {status: 200});
  } catch (error) {
    context.monitor?.failure('checkout.razorpay.webhook.failure', {}, error);
    return new Response('Reconciliation failed', {status: 500});
  }
}
