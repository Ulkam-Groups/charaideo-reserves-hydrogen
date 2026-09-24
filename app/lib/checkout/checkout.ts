import type {CheckoutProvider} from './provider.ts';
import {fastrrVariantId} from './providers/fastrr/fastrr.ts';

export type CheckoutProduct = {variantId: string; quantity: number};

export type CheckoutInput = {
  source: 'cart' | 'product';
  products: CheckoutProduct[];
  couponCode?: string;
  utmParams?: string;
  cartAttributes?: Record<string, string>;
};

export function canStartCheckout(
  provider: CheckoutProvider | null | undefined,
  products: CheckoutProduct[],
): boolean {
  if (provider !== 'fastrr' || products.length === 0) return false;

  return products.every(
    ({variantId, quantity}) => Boolean(fastrrVariantId(variantId)) && quantity > 0,
  );
}
