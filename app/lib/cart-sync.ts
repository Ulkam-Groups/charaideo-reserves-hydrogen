import type {CartApiQueryFragment} from 'storefrontapi.generated';

export const CART_LINE_FETCHER_KEY = 'cart-line-sync';

let latestCart: CartApiQueryFragment | null = null;
const listeners = new Set<() => void>();
let reconciliationGeneration = 0;
let reconciliation:
  | {generation: number; promise: Promise<CartApiQueryFragment | null>}
  | null = null;

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

export function invalidateCartReconciliation() {
  reconciliationGeneration += 1;
  reconciliation = null;
}

export function reconcileCartState() {
  const generation = reconciliationGeneration;
  if (reconciliation?.generation === generation) return reconciliation.promise;

  const promise = readCartStateWithRetry().finally(() => {
    if (reconciliation?.generation === generation) reconciliation = null;
  });
  reconciliation = {generation, promise};
  return promise;
}

async function readCartStateWithRetry() {
  for (const delay of [0, 120, 300]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const response = await fetch('/api/cart-state', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {Accept: 'application/json'},
      });
      if (!response.ok) continue;
      const result = (await response.json()) as {
        cart?: CartApiQueryFragment | null;
        unavailable?: boolean;
      };
      if (!result.unavailable) return result.cart ?? null;
    } catch {
      // Retry transient cart reads while the mutation overlay remains visible.
    }
  }
  throw new Error('Unable to refresh cart');
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
