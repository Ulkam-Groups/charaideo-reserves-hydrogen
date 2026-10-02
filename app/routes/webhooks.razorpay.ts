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
import {
  checkoutCorrelation,
  checkoutCount,
  checkoutFailure,
  checkoutLog,
  checkoutRequestId,
  checkoutResponse,
} from '~/lib/checkout/checkout-observability.server';

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

function shadowEnabled(env: Env) {
  return env.RAZORPAY_WEBHOOK_SHADOW_ENABLED?.trim().toLowerCase() === 'true';
}

function recoveryEnabled(env: Env) {
  return env.RAZORPAY_WEBHOOK_RECOVERY_ENABLED?.trim().toLowerCase() === 'true';
}

function safeEventName(payload: unknown) {
  const event =
    payload && typeof payload === 'object' && 'event' in payload
      ? (payload as {event?: unknown}).event
      : undefined;
  return typeof event === 'string' && /^[a-z_]+(?:\.[a-z_]+)+$/.test(event)
    ? event.slice(0, 64)
    : 'unknown';
}

export async function action({request, context}: ActionFunctionArgs) {
  const requestId = checkoutRequestId(request, context);
  const respond = (
    body: BodyInit | null,
    status: number,
    headers?: HeadersInit,
  ) => checkoutResponse(body, status, requestId, headers);
  if (request.method !== 'POST') {
    return respond('Method not allowed', 405, {Allow: 'POST'});
  }
  const secret = context.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get('x-razorpay-signature');
  if (!secret || !signature) {
    checkoutCount(
      context.monitor,
      'razorpay.webhook.invalid_signature',
      requestId,
      {reason: secret ? 'missing' : 'not_configured'},
    );
    return respond('Unauthorized', 401);
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return respond('Payload too large', 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return respond('Payload too large', 413);
  }
  if (!(await verifyRazorpayWebhook(rawBody, signature, secret))) {
    checkoutCount(
      context.monitor,
      'razorpay.webhook.invalid_signature',
      requestId,
    );
    checkoutLog({
      level: 'warn',
      scope: 'checkout.razorpay.webhook',
      stage: 'signature_verification',
      code: 'RAZORPAY_SIGNATURE_INVALID',
      requestId,
      status: 401,
    });
    return respond('Unauthorized', 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return respond('Invalid payload', 400);
  }

  const receivedEvent = safeEventName(payload);
  checkoutCount(context.monitor, 'razorpay.webhook.received', requestId, {
    event: receivedEvent,
  });

  if (isRazorpayPrepaidShadowEvent(payload)) {
    const target = razorpayPaidWebhookTarget(payload);
    const eventIdPresent = Boolean(request.headers.get('x-razorpay-event-id'));
    if (recoveryEnabled(context.env)) {
      if (!target) return respond('Invalid event payload', 400);

      const correlation = await checkoutCorrelation(target.orderId);
      if (!razorpayDraftOrderAnchorEnabled(context.env)) {
        const code = 'RAZORPAY_WEBHOOK_RECOVERY_MISCONFIGURED';
        checkoutFailure(
          context.monitor,
          'checkout.razorpay.webhook.recovery.failure',
          requestId,
          {event: 'order.paid', code, eventIdPresent, correlation},
          new Error(code),
        );
        console.error('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: 'failed',
          code,
          eventIdPresent,
          correlation,
          requestId,
        });
        return respond('Recovery is not configured', 503);
      }
      try {
        const {shopifyOrder} = await retryPendingRazorpayFinalization(() =>
          reconcileRazorpayOrder({
            ...target,
            env: context.env,
            requireDraftOrderAnchor: true,
          }),
          undefined,
          (attempt, delay) =>
            checkoutCount(
              context.monitor,
              'razorpay.finalization.retry',
              requestId,
              {attempt, delay, writer: 'webhook'},
            ),
        );
        checkoutCount(context.monitor, 'checkout.razorpay.webhook.recovery', requestId, {
          event: 'order.paid',
          outcome: shopifyOrder.created ? 'completed' : 'already_completed',
          eventIdPresent,
        });
        checkoutCount(
          context.monitor,
          shopifyOrder.created
            ? 'shopify.order.created'
            : 'shopify.existing_order.found',
          requestId,
          {writer: 'webhook'},
        );
        console.info('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: shopifyOrder.created ? 'completed' : 'already_completed',
          eventIdPresent,
          correlation,
          requestId,
        });
        return respond(null, 204);
      } catch (error) {
        const code = razorpayVerificationFailureCode(error);
        const retryable = code !== 'RAZORPAY_ORDER_DATA_INVALID';
        checkoutFailure(
          context.monitor,
          'checkout.razorpay.webhook.recovery.failure',
          requestId,
          {event: 'order.paid', code, eventIdPresent, correlation},
          error,
        );
        console.error('Razorpay webhook recovery observation', {
          event: 'order.paid',
          outcome: retryable ? 'failed' : 'ineligible',
          code,
          eventIdPresent,
          correlation,
          requestId,
        });
        return retryable
          ? respond('Reconciliation failed', 500)
          : respond(null, 204);
      }
    }

    if (!shadowEnabled(context.env)) return respond(null, 204);

    if (!target) {
      checkoutCount(context.monitor, 'checkout.razorpay.webhook.shadow', requestId, {
        event: 'order.paid',
        outcome: 'invalid_payload',
        eventIdPresent,
      });
      console.warn('Razorpay webhook shadow observation', {
        event: 'order.paid',
        outcome: 'invalid_payload',
        eventIdPresent,
        requestId,
      });
      return respond(null, 204);
    }

    const observe = async () => {
      let correlation = 'unavailable';
      try {
        correlation = await checkoutCorrelation(target.orderId);
        await inspectRazorpayPrepaidOrder({...target, env: context.env});
        checkoutCount(context.monitor, 'checkout.razorpay.webhook.shadow', requestId, {
          event: 'order.paid',
          outcome: 'eligible',
          eventIdPresent,
        });
        console.info('Razorpay webhook shadow observation', {
          event: 'order.paid',
          outcome: 'eligible',
          eventIdPresent,
          correlation,
          requestId,
        });
      } catch (error) {
        const code = razorpayVerificationFailureCode(error);
        checkoutFailure(
          context.monitor,
          'checkout.razorpay.webhook.shadow.failure',
          requestId,
          {event: 'order.paid', code, eventIdPresent, correlation},
          error,
        );
        console.warn('Razorpay webhook shadow observation', {
          event: 'order.paid',
          outcome: 'ineligible',
          code,
          eventIdPresent,
          correlation,
          requestId,
        });
      }
    };
    const observation = observe();
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(observation);
    } else {
      await observation;
    }
    return respond(null, 204);
  }

  const target = razorpayWebhookTarget(payload);
  if (!target) {
    return isRazorpayReconciliationEvent(payload)
      ? respond('Invalid event payload', 400)
      : respond(null, 204);
  }

  try {
    await reconcileRazorpayOrder({...target, env: context.env});
    return respond(null, 200);
  } catch (error) {
    checkoutFailure(
      context.monitor,
      'checkout.razorpay.webhook.failure',
      requestId,
      {event: receivedEvent},
      error,
    );
    return respond('Reconciliation failed', 500);
  }
}
