export type FastrrProduct = {variantId: string; quantity: number};

export type FastrrCheckoutInput = {
  type: 'cart' | 'product';
  products: FastrrProduct[];
  couponCode?: string;
  utmParams?: string;
  cartAttributes?: Record<string, string>;
};

export function fastrrVariantId(gid: string): string | null {
  const match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(gid);
  return match?.[1] ?? null;
}
