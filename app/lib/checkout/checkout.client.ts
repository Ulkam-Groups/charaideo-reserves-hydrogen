import type {CheckoutProvider} from './provider.ts';
import {canStartCheckout, type CheckoutInput} from './checkout.ts';
import {startFastrrCheckout} from './providers/fastrr/fastrr.client.ts';
import {fastrrVariantId} from './providers/fastrr/fastrr.ts';
import {startRazorpayCheckout} from './providers/razorpay/razorpay.client.ts';

export async function startCheckout(
  provider: CheckoutProvider | null | undefined,
  input: CheckoutInput,
): Promise<boolean> {
  if (!canStartCheckout(provider, input.products)) return false;

  if (provider === 'razorpay') return startRazorpayCheckout(input);

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
