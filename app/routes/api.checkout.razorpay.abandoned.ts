import type {ActionFunctionArgs} from 'react-router';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {updateAbandonedRazorpayDraft} from '~/lib/checkout/providers/razorpay/razorpay-abandoned.server';
import {readProtectedForm} from '~/lib/protected-write.server';

export async function action({request, context}: ActionFunctionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 16_384});
  if (form instanceof Response) return form;
  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return Response.json({error: 'Checkout provider is unavailable'}, {status: 404});
  }

  const orderId = form.get('razorpay_order_id');
  const rawAnalytics = form.get('analytics');
  const expectedOrderId = context.session.get('razorpayOrderId');
  const expectedDraftOrderId = context.session.get('razorpayDraftOrderId');
  if (
    typeof orderId !== 'string' ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    orderId !== expectedOrderId ||
    typeof expectedDraftOrderId !== 'string' ||
    !/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(expectedDraftOrderId) ||
    typeof rawAnalytics !== 'string'
  ) {
    return Response.json({error: 'Invalid abandonment request'}, {status: 400});
  }

  let analyticsPayload: unknown;
  try {
    analyticsPayload = JSON.parse(rawAnalytics);
  } catch {
    return Response.json({error: 'Invalid abandonment request'}, {status: 400});
  }

  try {
    const result = await updateAbandonedRazorpayDraft({
      env: context.env,
      orderId,
      analyticsPayload,
      expectedDraftOrderId,
    });
    return Response.json({updated: result.updated}, {status: 200});
  } catch (error) {
    console.error('Unable to record Razorpay checkout abandonment', error);
    return Response.json({error: 'Abandonment update failed'}, {status: 500});
  }
}
