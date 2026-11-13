import type {CheckoutInput} from '../../checkout.ts';
import {dispatchCheckoutError} from '../../checkout-errors.ts';
import {dispatchCheckoutConfirmation} from '../../checkout-progress.ts';
import {recordRazorpayCheckout} from '../../../monitoring-signals.ts';
import {RAZORPAY_ASSETS} from './razorpay.config.ts';

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInstance = {
  open(): void;
  on(event: 'payment.failed', handler: () => void): void;
  on(event: 'mx-analytics', handler: (payload: unknown) => void): void;
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
  if (!Razorpay) {
    recordRazorpayCheckout(input.source, 'checkout_unavailable');
    return false;
  }

  try {
    const orderResponse = await postForm('/api/checkout/razorpay/order', {
      source: input.source,
      products: JSON.stringify(input.products),
      ...(input.couponCode ? {couponCode: input.couponCode} : {}),
      ...(input.utmParams ? {utmParams: input.utmParams} : {}),
    });
    if (!orderResponse.ok) {
      recordRazorpayCheckout(input.source, 'order_request_failed', {
        status: orderResponse.status,
      });
      return false;
    }

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
      recordRazorpayCheckout(input.source, 'order_response_invalid');
      return false;
    }
    const razorpayOrderId = order.orderId;

    const checkout = new Razorpay({
      key: order.keyId,
      one_click_checkout: true,
      name: order.businessName,
      order_id: razorpayOrderId,
      show_coupons: false,
      handler(response) {
        dispatchCheckoutConfirmation(true);
        void postForm('/api/checkout/razorpay/verify', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        })
          .then(async (verification) => {
            if (!verification.ok) {
              recordRazorpayCheckout(input.source, 'verification_failed', {
                status: verification.status,
              });
              throw new Error('Payment verification failed');
            }
            const result = (await verification.json()) as {redirectTo?: unknown};
            if (typeof result.redirectTo !== 'string') {
              recordRazorpayCheckout(input.source, 'verification_failed');
              throw new Error('Payment verification response is invalid');
            }
            recordRazorpayCheckout(input.source, 'verified');
            window.location.assign(result.redirectTo);
          })
          .catch(() => {
            dispatchCheckoutConfirmation(false);
            dispatchCheckoutError(
              'Payment was received, but order confirmation is still processing. Please contact support if it does not appear shortly.',
            );
          });
      },
    });
    checkout.on('mx-analytics', (payload) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        (payload as {event?: unknown}).event !== 'checkout_abandoned'
      ) {
        return;
      }
      const data = payload as Record<string, unknown>;
      const analytics = JSON.stringify({
        event: data.event,
        time_since_open: data.time_since_open,
        email: data.email,
        phone: data.phone,
        first_name: data.first_name,
        last_name: data.last_name,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        zipcode: data.zipcode,
        country_name: data.country_name,
      });
      if (typeof analytics !== 'string') return;
      void postForm('/api/checkout/razorpay/abandoned', {
        razorpay_order_id: razorpayOrderId,
        analytics,
      }).catch(() => {
        // Abandonment reporting is best-effort and must never interrupt checkout.
      });
    });
    checkout.on('payment.failed', () => {
      recordRazorpayCheckout(input.source, 'payment_failed');
      dispatchCheckoutConfirmation(false);
      dispatchCheckoutError(
        'Payment could not be completed. Please check the details and try again.',
      );
    });
    checkout.open();
    recordRazorpayCheckout(input.source, 'checkout_opened');
    return true;
  } catch (error) {
    recordRazorpayCheckout(input.source, 'order_request_failed', {error});
    return false;
  }
}
