import {useEffect, useState, useSyncExternalStore} from 'react';
import {useOptimisticCart} from '@shopify/hydrogen';
import {useFetcher} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {
  CART_LINE_FETCHER_KEY,
  getPublishedCart,
  getServerCart,
  subscribeToCart,
} from '~/lib/cart-sync';

type CartMutationData = {cart?: CartApiQueryFragment | null};

export function useSyncedCart(originalCart: CartApiQueryFragment | null) {
  const lineFetcher = useFetcher<CartMutationData>({key: CART_LINE_FETCHER_KEY});
  const publishedCart = useSyncExternalStore(
    subscribeToCart,
    getPublishedCart,
    getServerCart,
  );
  const [confirmedCart, setConfirmedCart] = useState(originalCart);
  // A completed client mutation is authoritative for this browser session.
  // Shopify can return identical `updatedAt` values for rapid mutations, so
  // timestamp comparison alone can allow the older root cart to win.
  const mutationCart = publishedCart ?? lineFetcher.data?.cart ?? null;
  const baseCart = mutationCart ?? confirmedCart;

  useEffect(() => {
    setConfirmedCart((current) => newerCart(current, originalCart));
  }, [originalCart]);

  useEffect(() => {
    if (mutationCart) {
      setConfirmedCart((current) => newerCart(current, mutationCart));
    }
  }, [mutationCart?.id, mutationCart?.updatedAt, mutationCart?.totalQuantity]);

  return useOptimisticCart(baseCart);
}

function newerCart(
  current: CartApiQueryFragment | null,
  candidate: CartApiQueryFragment | null,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt)
    ? candidate
    : current;
}
