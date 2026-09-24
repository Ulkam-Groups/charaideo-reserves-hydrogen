import type {CheckoutProvider} from './provider.ts';
import {
  fastrrVariantId,
  startFastrrCheckout,
} from './providers/fastrr/fastrr.client.ts';

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
    ({variantId, quantity}) =>
      Boolean(fastrrVariantId(variantId)) && quantity > 0,
  );
}

export function startCheckout(
  provider: CheckoutProvider | null | undefined,
  input: CheckoutInput,
): boolean {
  if (!canStartCheckout(provider, input.products)) return false;

  const products = input.products.map(({variantId, quantity}) => ({
    variantId: fastrrVariantId(variantId)!,
    quantity,
  }));

  const {source, ...checkoutData} = input;
  return startFastrrCheckout({
    ...checkoutData,
    type: source,
    products,
  });
}
