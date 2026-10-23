import {useEffect, useState, useSyncExternalStore} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {
  getPublishedCart,
  getServerCart,
  subscribeToCart,
} from '~/lib/cart-sync';

export function useSyncedCart(originalCart: CartApiQueryFragment | null) {
  const publishedCart = useSyncExternalStore(
    subscribeToCart,
    getPublishedCart,
    getServerCart,
  );
  const [confirmedCart, setConfirmedCart] = useState(originalCart);
  // A completed client mutation is authoritative for this browser session.
  // Shopify can return identical `updatedAt` values for rapid mutations, so
  // timestamp comparison alone can allow the older root cart to win.
  const synchronizedCart = publishedCart
    ? newerCart(confirmedCart, publishedCart)
    : confirmedCart;

  useEffect(() => {
    setConfirmedCart((current) => newerCart(current, originalCart));
  }, [originalCart]);

  useEffect(() => {
    if (publishedCart) {
      setConfirmedCart((current) => newerCart(current, publishedCart));
    }
  }, [
    publishedCart?.id,
    publishedCart?.updatedAt,
    publishedCart?.totalQuantity,
  ]);

  return synchronizedCart;
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
