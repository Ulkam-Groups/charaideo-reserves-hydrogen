export type CheckoutProvider = 'fastrr' | 'razorpay';

export const DEFAULT_CHECKOUT_PROVIDER: CheckoutProvider = 'fastrr';

export function resolveCheckoutProvider(
  value: string | null | undefined,
): CheckoutProvider | null {
  const provider = value?.trim().toLowerCase();

  if (!provider) return DEFAULT_CHECKOUT_PROVIDER;
  if (provider === 'fastrr' || provider === 'razorpay') return provider;

  return null;
}
