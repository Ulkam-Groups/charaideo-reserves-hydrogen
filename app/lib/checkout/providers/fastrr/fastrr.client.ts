import {recordFastrrLaunch} from '../../../monitoring-signals.ts';

export type FastrrProduct = {variantId: string; quantity: number};

export type FastrrCheckoutInput = {
  type: 'cart' | 'product';
  products: FastrrProduct[];
  couponCode?: string;
  utmParams?: string;
  cartAttributes?: Record<string, string>;
};

declare global {
  interface Window {
    shiprocketCheckoutEvents?: {
      buyDirect: (input: FastrrCheckoutInput) => void;
    };
  }
}

export function fastrrVariantId(gid: string): string | null {
  const match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(gid);
  return match?.[1] ?? null;
}

export function startFastrrCheckout(input: FastrrCheckoutInput): boolean {
  if (
    typeof window === 'undefined' ||
    !window.shiprocketCheckoutEvents?.buyDirect
  ) {
    recordFastrrLaunch(input.type, 'missing');
    return false;
  }
  try {
    window.shiprocketCheckoutEvents.buyDirect(input);
    recordFastrrLaunch(input.type, 'requested');
    return true;
  } catch (error) {
    recordFastrrLaunch(input.type, 'threw', error);
    return false;
  }
}
