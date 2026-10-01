import type {CheckoutInput} from '../../checkout.ts';
import {dispatchCheckoutError} from '../../checkout-errors.ts';
import {RAZORPAY_ASSETS} from './razorpay.config.ts';

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

async function waitForRazorpay(): Promise<RazorpayCheckoutConstructor | null> {
  if (typeof window === 'undefined') return null;
  if (window.Razorpay) return window.Razorpay;
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    let observedScript: HTMLScriptElement | null = null;
    let settled = false;
    const finish = (value: RazorpayCheckoutConstructor | null) => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      clearTimeout(timeout);
      observedScript?.removeEventListener('load', check);
      observedScript?.removeEventListener('error', failed);
      resolve(value);
    };
    const failed = () => finish(null);
    const check = () => {
      if (window.Razorpay) {
        finish(window.Razorpay);
        return;
      }
      const script = document.querySelector<HTMLScriptElement>(
        `script[src="${RAZORPAY_ASSETS.script}"]`,
      );
      if (script && script !== observedScript) {
        observedScript?.removeEventListener('load', check);
        observedScript?.removeEventListener('error', failed);
        observedScript = script;
        script.addEventListener('load', check, {once: true});
        script.addEventListener('error', failed, {once: true});
      }
    };
    const interval = setInterval(check, 25);
    const timeout = setTimeout(() => finish(null), 10_000);
    check();
  });
}

export async function startRazorpayCheckout(input: CheckoutInput): Promise<boolean> {
  const Razorpay = await waitForRazorpay();
  if (!Razorpay) return false;

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

    const checkout = new Razorpay({
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
