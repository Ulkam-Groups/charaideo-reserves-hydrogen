import type {Route} from './+types/api.razorpay-confirm';
import {synchronizeConfirmedOrder, verifyCheckoutSignature} from '~/lib/razorpay.server';

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405});
  if (request.headers.get('Origin') !== new URL(request.url).origin) return new Response('Forbidden', {status: 403});
  const secret = context.env.RAZORPAY_KEY_SECRET;
  if (!secret) return new Response('Checkout unavailable', {status: 503});
  if (Number(request.headers.get('content-length') || 0) > 4096) return new Response('Payload too large', {status: 413});
  let input: {razorpay_order_id?: unknown; razorpay_payment_id?: unknown; razorpay_signature?: unknown};
  try { input = await request.json(); } catch { return new Response('Invalid JSON', {status: 400}); }
  const orderId = input.razorpay_order_id;
  const paymentId = input.razorpay_payment_id;
  const signature = input.razorpay_signature;
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || context.session.get('magicCheckoutOrderId') !== orderId) {
    return new Response('Unauthorized', {status: 401});
  }
  if (!(await verifyCheckoutSignature(orderId, paymentId, signature, secret))) return new Response('Unauthorized', {status: 401});
  try {
    const order = await synchronizeConfirmedOrder(context.env, orderId, paymentId);
    return Response.json({orderName: order.name}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error(JSON.stringify({scope: 'razorpay-confirm', orderId, errorName: error instanceof Error ? error.name : 'UnknownError'}));
    return Response.json({error: 'Checkout was submitted. Payment and Shopify order confirmation are pending; please contact us if the order does not appear shortly.'}, {status: 202, headers: {'Cache-Control': 'no-store'}});
  }
}
