import {useEffect, useState, useSyncExternalStore} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {
  getPublishedCart,
  getServerCart,
  selectAuthoritativeCart,
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
    ? selectAuthoritativeCart(confirmedCart, publishedCart)
    : confirmedCart;

  useEffect(() => {
    setConfirmedCart((current) => selectAuthoritativeCart(current, originalCart));
  }, [originalCart]);

  useEffect(() => {
    if (publishedCart) {
      setConfirmedCart((current) => selectAuthoritativeCart(current, publishedCart));
    }
  }, [publishedCart]);

  return synchronizedCart;
}
