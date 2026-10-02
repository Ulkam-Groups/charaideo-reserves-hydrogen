import type {ActionFunctionArgs} from 'react-router';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  classifyRazorpayFailure,
  razorpayCredentials,
  verifyRazorpayPayment,
} from '~/lib/checkout/providers/razorpay/razorpay.server';
import {
  reconcileRazorpayOrder,
  retryPendingRazorpayFinalization,
  razorpayVerificationFailureCode,
} from '~/lib/checkout/providers/razorpay/razorpay-order.server';
import {
  checkoutCorrelation,
  checkoutCount,
  checkoutFailure,
  checkoutJson,
  checkoutLog,
  checkoutRequestId,
} from '~/lib/checkout/checkout-observability.server';

type VerificationStage =
  | 'request_validation'
  | 'session_binding'
  | 'signature_verification'
  | 'razorpay_final_state'
  | 'shopify_authentication'
  | 'shopify_order_create'
  | 'session_confirmation';

function failureStage(code: string, fallback: VerificationStage): VerificationStage {
  if (code === 'RAZORPAY_SIGNATURE_INVALID') return 'signature_verification';
  if (code.startsWith('RAZORPAY_')) return 'razorpay_final_state';
  if (
    code === 'SHOPIFY_AUTHENTICATION_FAILED' ||
    code === 'SHOPIFY_REQUIRED_SCOPE_MISSING'
  ) {
    return 'shopify_authentication';
  }
  if (code.startsWith('SHOPIFY_')) return 'shopify_order_create';
  return fallback;
}

export async function action({request, context}: ActionFunctionArgs) {
  const requestId = checkoutRequestId(request, context);
  const json = (body: unknown, status = 200) =>
    checkoutJson(body, status, requestId);
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 4_096});
  if (form instanceof Response) {
    form.headers.set('X-Request-Id', requestId);
    return form;
  }

  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return json({error: 'Checkout provider is unavailable'}, 404);
  }
  const credentials = razorpayCredentials(context.env);
  if (!credentials) return json({error: 'Checkout is not configured'}, 503);

  const orderId = form.get('razorpay_order_id');
  const paymentId = form.get('razorpay_payment_id');
  const signature = form.get('razorpay_signature');
  const expectedOrderId = context.session.get('razorpayOrderId');
  let stage: VerificationStage = 'request_validation';
  checkoutCount(context.monitor, 'razorpay.verify.started', requestId);
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    const code = 'INVALID_VERIFICATION_REQUEST';
    checkoutFailure(
      context.monitor,
      'checkout.razorpay.verify.failure',
      requestId,
      {code, stage},
    );
    checkoutCount(context.monitor, 'razorpay.verify.failed', requestId, {
      code,
      stage,
    });
    checkoutLog({
      level: 'warn',
      scope: 'checkout.razorpay.verify',
      stage,
      code,
      requestId,
      status: 400,
    });
    return json({error: 'Invalid payment verification'}, 400);
  }

  stage = 'session_binding';
  if (orderId !== expectedOrderId) {
    const code = 'INVALID_VERIFICATION_REQUEST';
    checkoutFailure(
      context.monitor,
      'checkout.razorpay.verify.failure',
      requestId,
      {code, stage},
    );
    checkoutCount(context.monitor, 'razorpay.verify.failed', requestId, {
      code,
      stage,
    });
    checkoutLog({
      level: 'warn',
      scope: 'checkout.razorpay.verify',
      stage,
      code,
      requestId,
      status: 400,
    });
    return json({error: 'Invalid payment verification'}, 400);
  }

  const correlation = await checkoutCorrelation(orderId);
  try {
    stage = 'signature_verification';
    if (!(await verifyRazorpayPayment({credentials, orderId, paymentId, signature}))) {
      const code = 'RAZORPAY_SIGNATURE_INVALID';
      checkoutFailure(
        context.monitor,
        'checkout.razorpay.verify.failure',
        requestId,
        {code, stage, correlation},
      );
      checkoutCount(context.monitor, 'razorpay.verify.failed', requestId, {
        code,
        stage,
      });
      checkoutLog({
        level: 'warn',
        scope: 'checkout.razorpay.verify',
        stage,
        code,
        requestId,
        correlation,
        status: 400,
      });
      return json({error: 'Payment verification failed'}, 400);
    }
    stage = 'razorpay_final_state';
    const {shopifyOrder} = await retryPendingRazorpayFinalization(() =>
      reconcileRazorpayOrder({
        env: context.env,
        orderId,
        paymentId,
        draftOrderId: context.session.get('razorpayDraftOrderId') as string | undefined,
      }),
      undefined,
      (attempt, delay) =>
        checkoutCount(context.monitor, 'razorpay.finalization.retry', requestId, {
          attempt,
          delay,
        }),
    );
    stage = 'shopify_order_create';
    checkoutCount(
      context.monitor,
      shopifyOrder.created ? 'shopify.order.created' : 'shopify.existing_order.found',
      requestId,
    );
    stage = 'session_confirmation';
    context.session.unset('razorpayOrderId');
    context.session.unset('razorpayDraftOrderId');
    context.session.set('razorpayPaymentVerified', {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderName: shopifyOrder.name,
    });
    checkoutCount(context.monitor, 'razorpay.verify.succeeded', requestId);
    return json({redirectTo: '/checkout/razorpay/success'});
  } catch (error) {
    const reconciliationCode = razorpayVerificationFailureCode(error);
    const code =
      reconciliationCode === 'CHECKOUT_VERIFICATION_FAILED'
        ? classifyRazorpayFailure(error).code
        : reconciliationCode;
    stage = failureStage(code, stage);
    checkoutFailure(
      context.monitor,
      'checkout.razorpay.verify.failure',
      requestId,
      {code, stage, correlation},
      error,
    );
    checkoutCount(context.monitor, 'razorpay.verify.failed', requestId, {
      code,
      stage,
    });
    if (code.startsWith('SHOPIFY_')) {
      checkoutCount(context.monitor, 'shopify.order.failed', requestId, {
        code,
        stage,
      });
    }
    checkoutLog({
      level: 'error',
      scope: 'checkout.razorpay.verify',
      stage,
      code,
      requestId,
      correlation,
      status: 502,
    });
    return json({error: 'Payment verification or order creation failed', code}, 502);
  }
}
