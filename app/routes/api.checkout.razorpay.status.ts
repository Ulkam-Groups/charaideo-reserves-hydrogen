import type {ActionFunctionArgs} from 'react-router';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {enforceApiRateLimit} from '~/lib/api-rate-limit.server';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  fetchRazorpayCheckoutState,
  findShopifyOrder,
} from '~/lib/checkout/providers/razorpay/razorpay-order.server';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store'},
  });
}

export async function action({request, context}: ActionFunctionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 256});
  if (form instanceof Response) return form;

  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return json({error: 'Checkout provider is unavailable'}, 404);
  }
  if (request.headers.has('oxygen-buyer-ip')) {
    const limited = await enforceApiRateLimit(
      request,
      context.reviewsCache,
      '/api/checkout/razorpay/status',
    );
    if (limited) return limited;
  }

  const orderId = context.session.get('razorpayOrderId');
  if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
    return json({error: 'Checkout session is unavailable'}, 400);
  }

  try {
    const checkoutState = await fetchRazorpayCheckoutState({
      env: context.env,
      orderId,
    });
    if (checkoutState !== 'cod') {
      return json({status: checkoutState});
    }

    const shopifyOrder = await findShopifyOrder(context.env, orderId);
    if (!shopifyOrder) return json({status: 'processing'});

    context.session.unset('razorpayOrderId');
    context.session.set('razorpayPaymentVerified', {
      razorpayOrderId: orderId,
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderName: shopifyOrder.name,
      paymentMethod: 'cod',
      verifiedAt: Date.now(),
    });
    try {
      const cart = await context.cart.get();
      const lineIds = cart?.lines.nodes.map((line: {id: string}) => line.id) ?? [];
      if (lineIds.length) await context.cart.removeLines(lineIds);
    } catch (error) {
      context.monitor?.failure('checkout.razorpay.cart_clear.failure', {}, error);
    }

    return json({status: 'confirmed', redirectTo: '/checkout/razorpay/success'});
  } catch (error) {
    context.monitor?.failure('checkout.razorpay.status.failure', {}, error);
    return json({error: 'Unable to confirm checkout status'}, 502);
  }
}
