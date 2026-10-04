import {useAnalytics} from '@shopify/hydrogen';
import {useEffect, useMemo, useRef} from 'react';
import {
  acknowledgeMetaPurchase,
  META_ANALYTICS_EVENTS,
  META_PURCHASE_READY_EVENT,
  metaCommerceParameters,
  metaContentId,
  metaTrackingAllowed,
  pendingMetaPurchases,
  parseMetaCommercePayload,
  type MetaCommercePayload,
} from '~/lib/ads/meta/meta-pixel';

const META_PIXEL_SCRIPT_ID = 'meta-pixel-script';
const META_PIXEL_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js';

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  loaded: boolean;
  push: MetaPixelFunction;
  queue: unknown[][];
  version: string;
};

declare global {
  interface Window {
    _fbq?: MetaPixelFunction;
    fbq?: MetaPixelFunction;
  }
}

function installMetaPixel(pixelId: string) {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as MetaPixelFunction;

    fbq.loaded = true;
    fbq.push = fbq;
    fbq.queue = [];
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = fbq;
  }

  if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = META_PIXEL_SCRIPT_ID;
    script.async = true;
    script.src = META_PIXEL_SCRIPT_URL;
    script.addEventListener('error', () => {
      console.error('Meta Pixel failed to load.');
    });
    document.head.appendChild(script);
  }

  window.fbq('consent', 'grant');
  window.fbq('init', pixelId);
}

function metaEventId(eventName: string, stableKey?: string) {
  if (stableKey) return `meta_${eventName.toLowerCase()}_${stableKey}`.slice(0, 100);
  const uniqueId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `meta_${eventName.toLowerCase()}_${uniqueId}`.slice(0, 100);
}

function trackMeta(
  eventName: string,
  parameters: Record<string, unknown> = {},
  eventId?: string,
) {
  if (!metaTrackingAllowed() || !window.fbq) return false;
  window.fbq('track', eventName, parameters, {
    eventID: eventId ?? metaEventId(eventName),
  });
  return true;
}

function trackCommerceEvent(eventName: string, value: unknown) {
  const payload = parseMetaCommercePayload(value);
  if (!payload) return false;
  return trackMeta(
    eventName,
    metaCommerceParameters(payload),
    payload.eventId ?? metaEventId(eventName, payload.orderId),
  );
}

function productPayload(
  product: {
    id: string;
    price: string;
    productType?: string;
    quantity: number;
    title: string;
    variantId: string;
    vendor: string;
  },
  currency: string,
): MetaCommercePayload | null {
  const id = metaContentId(product.variantId);
  const itemPrice = Number(product.price);
  if (!id || !Number.isFinite(itemPrice) || itemPrice < 0) return null;
  return {
    currency,
    value: itemPrice * product.quantity,
    items: [
      {
        id,
        name: product.title,
        category: product.productType,
        brand: product.vendor,
        quantity: product.quantity,
        itemPrice,
      },
    ],
  };
}

/**
 * Loads Meta Pixel only after Hydrogen allows analytics, marketing and data sharing.
 * Hydrogen publishes `page_viewed` for the first render and client-side routes.
 */
export function MetaPixel({pixelId}: {pixelId: string}) {
  const {register, subscribe} = useAnalytics();
  const started = useRef(false);
  const subscribed = useRef(false);
  const trackingAllowed = useRef(false);
  const {ready} = useMemo(
    () => register(`MetaPixel:${pixelId}`),
    [pixelId, register],
  );

  useEffect(() => {
    let analyticsRegistrationReady = false;
    const drainPendingPurchases = () => {
      if (!metaTrackingAllowed()) return;
      for (const purchase of pendingMetaPurchases()) {
        if (trackCommerceEvent('Purchase', purchase)) {
          acknowledgeMetaPurchase(purchase);
        }
      }
    };
    const syncConsent = () => {
      const allowed = metaTrackingAllowed();
      const wasAllowed = trackingAllowed.current;
      trackingAllowed.current = allowed;
      if (started.current) {
        window.fbq?.('consent', allowed ? 'grant' : 'revoke');
        if (allowed) {
          drainPendingPurchases();
          if (!wasAllowed) trackMeta('PageView');
        }
        return;
      }
      if (!allowed) return;

      started.current = true;
      installMetaPixel(pixelId);
      drainPendingPurchases();
      // If consent was granted after initial registration, describe the page at
      // the moment tracking becomes allowed. Earlier activity stays discarded.
      if (analyticsRegistrationReady) trackMeta('PageView');
    };

    if (!subscribed.current) {
      subscribed.current = true;
      subscribe('page_viewed', () => trackMeta('PageView'));
      subscribe('product_viewed', (payload) => {
        const product = payload.products[0];
        if (!product) return;
        const commerce = productPayload(
          product,
          typeof product.currency === 'string'
            ? product.currency
            : (payload.shop?.currency ?? 'INR'),
        );
        if (commerce) trackCommerceEvent('ViewContent', commerce);
      });
      subscribe('search_viewed', (payload) => {
        if (payload.searchTerm) {
          trackMeta('Search', {search_string: payload.searchTerm});
        }
      });
      subscribe('product_added_to_cart', (payload) => {
        const line = payload.currentLine;
        if (!line) return;
        const merchandise = line.merchandise as {
          id?: string;
          price?: {amount?: string; currencyCode?: string};
          product?: {productType?: string; title?: string; vendor?: string};
        };
        const id = merchandise.id ? metaContentId(merchandise.id) : null;
        const itemPrice = Number(merchandise.price?.amount);
        const previousQuantity = payload.prevLine?.quantity ?? 0;
        const quantity = line.quantity - previousQuantity;
        if (!id || !Number.isFinite(itemPrice) || itemPrice < 0 || quantity < 1) {
          return;
        }
        trackCommerceEvent('AddToCart', {
          currency:
            merchandise.price?.currencyCode ?? payload.shop?.currency ?? 'INR',
          value: itemPrice * quantity,
          items: [
            {
              id,
              name: merchandise.product?.title,
              category: merchandise.product?.productType,
              brand: merchandise.product?.vendor,
              quantity,
              itemPrice,
            },
          ],
        });
      });
      subscribe(META_ANALYTICS_EVENTS.INITIATE_CHECKOUT, (payload) => {
        trackCommerceEvent('InitiateCheckout', payload);
      });
      subscribe(META_ANALYTICS_EVENTS.PURCHASE, (payload) => {
        trackCommerceEvent('Purchase', payload);
      });
    }

    document.addEventListener('visitorConsentCollected', syncConsent);
    document.addEventListener(META_PURCHASE_READY_EVENT, drainPendingPurchases);
    syncConsent();
    // Meta callbacks are consent-gated, so this integration must not block
    // Shopify analytics when marketing consent is declined.
    ready();
    analyticsRegistrationReady = true;

    return () => {
      document.removeEventListener('visitorConsentCollected', syncConsent);
      document.removeEventListener(META_PURCHASE_READY_EVENT, drainPendingPurchases);
    };
  }, [pixelId, ready, subscribe]);

  return null;
}
