import type {CheckoutInput} from '../../checkout.ts';
import {dispatchCheckoutError} from '../../checkout-errors.ts';

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInstance = {
  open(): void;
  on(event: 'payment.failed', handler: () => void): void;
};

type RazorpayCheckoutConstructor = new (options: {
  key: string;
  one_click_checkout: true;
  name: string;
  order_id: string;
  show_coupons: boolean;
  handler(response: RazorpayPaymentResponse): void;
}) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

async function postForm(path: string, fields: Record<string, string>) {
  return fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
    body: new URLSearchParams(fields),
  });
}

export async function startRazorpayCheckout(input: CheckoutInput): Promise<boolean> {
  if (typeof window === 'undefined' || !window.Razorpay) return false;

  try {
    const orderResponse = await postForm('/api/checkout/razorpay/order', {
      source: input.source,
      products: JSON.stringify(input.products),
      ...(input.couponCode ? {couponCode: input.couponCode} : {}),
      ...(input.utmParams ? {utmParams: input.utmParams} : {}),
    });
    if (!orderResponse.ok) return false;

    const order = (await orderResponse.json()) as {
      keyId?: unknown;
      orderId?: unknown;
      businessName?: unknown;
    };
    if (
      typeof order.keyId !== 'string' ||
      typeof order.orderId !== 'string' ||
      typeof order.businessName !== 'string'
    ) {
      return false;
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      one_click_checkout: true,
      name: order.businessName,
      order_id: order.orderId,
      show_coupons: false,
      handler(response) {
        void postForm('/api/checkout/razorpay/verify', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        })
          .then(async (verification) => {
            if (!verification.ok) throw new Error('Payment verification failed');
            const result = (await verification.json()) as {redirectTo?: unknown};
            if (typeof result.redirectTo !== 'string') {
              throw new Error('Payment verification response is invalid');
            }
            window.location.assign(result.redirectTo);
          })
          .catch(() => {
            dispatchCheckoutError(
              'Payment was received, but order confirmation is still processing. Please contact support if it does not appear shortly.',
            );
          });
      },
    });
    checkout.on('payment.failed', () => {
      dispatchCheckoutError(
        'Payment could not be completed. Please check the details and try again.',
      );
    });
    checkout.open();
    return true;
  } catch {
    return false;
  }
}
