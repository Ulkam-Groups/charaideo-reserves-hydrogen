import type {ActionFunctionArgs} from 'react-router';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {enforceApiRateLimit} from '~/lib/api-rate-limit.server';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  razorpayCredentials,
  verifyRazorpayPayment,
} from '~/lib/checkout/providers/razorpay/razorpay.server';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store'},
  });
}

export async function action({request, context}: ActionFunctionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 4_096});
  if (form instanceof Response) return form;

  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return json({error: 'Checkout provider is unavailable'}, 404);
  }
  if (request.headers.has('oxygen-buyer-ip')) {
    const limited = await enforceApiRateLimit(
      request,
      context.reviewsCache,
      '/api/checkout/razorpay/verify',
    );
    if (limited) return limited;
  }
  const credentials = razorpayCredentials(context.env);
  if (!credentials) return json({error: 'Checkout is not configured'}, 503);

  const orderId = form.get('razorpay_order_id');
  const paymentId = form.get('razorpay_payment_id');
  const signature = form.get('razorpay_signature');
  const expectedOrderId = context.session.get('razorpayOrderId');
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    orderId !== expectedOrderId
  ) {
    return json({error: 'Invalid payment verification'}, 400);
  }

  if (!(await verifyRazorpayPayment({credentials, orderId, paymentId, signature}))) {
    return json({error: 'Payment verification failed'}, 400);
  }

  context.session.unset('razorpayOrderId');
  context.session.set('razorpayPaymentVerified', {
    razorpayOrderId: orderId,
    shopifyOrderId: null,
    shopifyOrderName: null,
    paymentMethod: 'prepaid',
    verifiedAt: Date.now(),
  });
  try {
    const cart = await context.cart.get();
    const lineIds = cart?.lines.nodes.map((line: {id: string}) => line.id) ?? [];
    if (lineIds.length) await context.cart.removeLines(lineIds);
  } catch (error) {
    context.monitor?.failure('checkout.razorpay.cart_clear.failure', {}, error);
  }
  return json({redirectTo: '/checkout/razorpay/success'});
}
