import type {CartApiQueryFragment} from 'storefrontapi.generated';

export const CART_LINE_FETCHER_KEY = 'cart-line-sync';

let latestCart: CartApiQueryFragment | null = null;
const listeners = new Set<() => void>();

export function publishCart(cart: CartApiQueryFragment | null | undefined) {
  if (!cart) return;
  latestCart = cart;
  listeners.forEach((listener) => listener());
}

export function subscribeToCart(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPublishedCart() {
  return latestCart;
}

export function getServerCart() {
  return null;
}

export function selectAuthoritativeCart(
  current: CartApiQueryFragment | null,
  candidate: CartApiQueryFragment | null,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt)
    ? candidate
    : current;
}
