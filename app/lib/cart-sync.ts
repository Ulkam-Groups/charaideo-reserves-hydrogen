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

export async function refreshPublishedCart() {
  invalidateCartReconciliation();
  const cart = await reconcileCartState();
  if (cart) publishCart(cart);
  return cart;
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
      if (!result.unavailable && isCartSnapshotComplete(result.cart)) {
        return result.cart ?? null;
      }
    } catch {
      // Retry transient cart reads while the mutation overlay remains visible.
    }
  }
  throw new Error('Unable to refresh cart');
}

function isCartSnapshotComplete(
  cart: CartApiQueryFragment | null | undefined,
) {
  if (!cart || cart.totalQuantity === 0) return true;

  // Older callers/tests may provide a deliberately partial cart shape. The
  // Storefront API fragment always includes `lines`; only treat an explicitly
  // empty returned connection as the transient inconsistency.
  const lines = cart.lines?.nodes;
  if (!lines) return true;
  if (!lines.length) return false;

  return lines.reduce((quantity, line) => quantity + line.quantity, 0) >=
    cart.totalQuantity;
}

export function selectAuthoritativeCart(
  current: CartApiQueryFragment | null,
  candidate: CartApiQueryFragment | null,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  // A cart read can briefly expose the new total before its lines are
  // queryable (most often when the first cart is created). Never let that
  // partial snapshot erase a complete mutation response.
  if (isCartSnapshotComplete(current) && !isCartSnapshotComplete(candidate)) {
    return current;
  }
  // Shopify can reuse the same `updatedAt` value for the first mutation and a
  // concurrent stale loader read. Do not let an equal-timestamp empty snapshot
  // erase the authoritative first-item mutation. A truly newer empty cart is
  // still accepted when the last item is intentionally removed.
  if (
    current.totalQuantity > 0 &&
    candidate.totalQuantity === 0 &&
    Date.parse(candidate.updatedAt) === Date.parse(current.updatedAt)
  ) {
    return current;
  }
  return Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt)
    ? candidate
    : current;
}
