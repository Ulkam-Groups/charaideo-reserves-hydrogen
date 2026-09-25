import Razorpay from 'razorpay';
import {
  buildRazorpayMagicOrder,
  encodeRazorpayCheckoutSnapshot,
  type RazorpayOrderLine,
} from './razorpay.ts';

export type RazorpayCredentials = {keyId: string; keySecret: string};

export type RazorpayFailure = {
  code:
    | 'RAZORPAY_AUTHENTICATION_FAILED'
    | 'RAZORPAY_ORDER_REJECTED'
    | 'RAZORPAY_RATE_LIMITED'
    | 'RAZORPAY_PROVIDER_UNAVAILABLE'
    | 'RAZORPAY_RUNTIME_FAILURE';
  tags: Record<string, string | number>;
};

export function classifyRazorpayFailure(error: unknown): RazorpayFailure {
  const value =
    error && typeof error === 'object'
      ? (error as {
          statusCode?: unknown;
          error?: {code?: unknown};
        })
      : null;
  const statusCode =
    typeof value?.statusCode === 'number' &&
    Number.isInteger(value.statusCode) &&
    value.statusCode >= 400 &&
    value.statusCode <= 599
      ? value.statusCode
      : undefined;
  const providerCode =
    typeof value?.error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(value.error.code)
      ? value.error.code
      : undefined;
  const reason =
    statusCode === 401 || statusCode === 403
      ? 'authentication'
      : statusCode === 400 || statusCode === 422
        ? 'order_rejected'
        : statusCode === 429
          ? 'rate_limited'
          : statusCode !== undefined && statusCode >= 500
            ? 'provider_unavailable'
            : 'runtime';
  const code: RazorpayFailure['code'] =
    reason === 'authentication'
      ? 'RAZORPAY_AUTHENTICATION_FAILED'
      : reason === 'order_rejected'
        ? 'RAZORPAY_ORDER_REJECTED'
        : reason === 'rate_limited'
          ? 'RAZORPAY_RATE_LIMITED'
          : reason === 'provider_unavailable'
            ? 'RAZORPAY_PROVIDER_UNAVAILABLE'
            : 'RAZORPAY_RUNTIME_FAILURE';

  return {
    code,
    tags: {
      provider: 'razorpay',
      reason,
      ...(statusCode === undefined ? {} : {upstreamStatus: statusCode}),
      ...(providerCode ? {providerCode} : {}),
    },
  };
}

async function razorpayClient(credentials: RazorpayCredentials) {
  return new Razorpay({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
}

async function hmacSha256Hex(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function constantTimeHexEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

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
  const razorpay = await razorpayClient(credentials);
  const receipt = `cr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const order = await razorpay.orders.create({
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
  } as unknown as Parameters<typeof razorpay.orders.create>[0]);

  return {id: order.id, amount};
}

export async function verifyRazorpayWebhook(
  rawBody: string,
  signature: string,
  secret: string,
) {
  return constantTimeHexEqual(await hmacSha256Hex(rawBody, secret), signature);
}

export async function verifyRazorpayPayment({
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
  return constantTimeHexEqual(
    await hmacSha256Hex(`${orderId}|${paymentId}`, credentials.keySecret),
    signature,
  );
}
