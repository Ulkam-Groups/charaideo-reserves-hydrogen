import Razorpay from 'razorpay';
import {
  validatePaymentVerification,
  validateWebhookSignature,
} from 'razorpay/dist/utils/razorpay-utils.js';
import {
  buildRazorpayMagicOrder,
  encodeRazorpayCheckoutSnapshot,
  type RazorpayOrderLine,
} from './razorpay.ts';

export type RazorpayCredentials = {keyId: string; keySecret: string};

export function razorpayCredentials(env: Env): RazorpayCredentials | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && keySecret ? {keyId, keySecret} : null;
}

export async function createRazorpayMagicOrder({
  credentials,
  lines,
  source,
  notes,
  expectedAmount,
}: {
  credentials: RazorpayCredentials;
  lines: RazorpayOrderLine[];
  source: 'cart' | 'product';
  notes?: Record<string, string>;
  expectedAmount?: number;
}) {
  const {amount, lineItems} = buildRazorpayMagicOrder(lines);
  if (expectedAmount !== undefined && amount !== expectedAmount) {
    throw new Error('Razorpay order total does not match Shopify');
  }
  const razorpay = new Razorpay({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
  const receipt = `cr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const order = await razorpay.orders.create(
    {
      amount,
      currency: 'INR',
      receipt,
      line_items_total: amount,
      line_items: lineItems,
      notes: {
        source,
        ...encodeRazorpayCheckoutSnapshot(lines),
        ...(notes ?? {}),
      },
    } as unknown as Parameters<typeof razorpay.orders.create>[0],
  );

  return {id: order.id, amount};
}

export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string,
  secret: string,
) {
  return validateWebhookSignature(rawBody, signature, secret);
}

export function verifyRazorpayPayment({
  credentials,
  orderId,
  paymentId,
  signature,
}: {
  credentials: RazorpayCredentials;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  return validatePaymentVerification(
    {order_id: orderId, payment_id: paymentId},
    signature,
    credentials.keySecret,
  );
}
