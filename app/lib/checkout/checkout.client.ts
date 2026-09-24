import type {CheckoutProvider} from './provider.ts';
import {canStartCheckout, type CheckoutInput} from './checkout.ts';
import {startFastrrCheckout} from './providers/fastrr/fastrr.client.ts';
import {fastrrVariantId} from './providers/fastrr/fastrr.ts';

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
