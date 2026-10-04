export const DEFAULT_META_PIXEL_ID = '1130857422791298';

export const META_ANALYTICS_EVENTS = {
  INITIATE_CHECKOUT: 'custom_meta_initiate_checkout',
  PURCHASE: 'custom_meta_purchase',
} as const;

export const META_PURCHASE_READY_EVENT = 'meta:purchase-ready';
const META_PENDING_PURCHASES_KEY = 'charaideo:meta:pending-purchases';

export const META_FASTRR_ATTRIBUTES = {
  PROVIDER: '__cr_checkout_provider',
  CONSENT: '__cr_meta_consent',
  FBP: '__cr_meta_fbp',
  FBC: '__cr_meta_fbc',
  SOURCE_URL: '__cr_meta_source_url',
  USER_AGENT: '__cr_meta_user_agent',
} as const;

export type MetaCommerceItem = {
  id: string;
  name?: string;
  category?: string;
  brand?: string;
  quantity: number;
  itemPrice: number;
};

export type MetaCommercePayload = {
  currency: string;
  eventId?: string;
  items: MetaCommerceItem[];
  orderId?: string;
  value: number;
};

export function resolveMetaPixelId(configuredPixelId?: string) {
  const pixelId = configuredPixelId?.trim() || DEFAULT_META_PIXEL_ID;

  return /^\d+$/.test(pixelId) ? pixelId : null;
}

export function metaTrackingAllowed() {
  if (typeof window === 'undefined') return false;
  const privacy = window.Shopify?.customerPrivacy;
  return Boolean(
    privacy?.analyticsProcessingAllowed?.() &&
      privacy.marketingAllowed?.() &&
      privacy.saleOfDataAllowed?.(),
  );
}

function cookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function validMetaBrowserId(value: string | null) {
  return value && /^fb\.\d+\.\d+\.[A-Za-z0-9._-]+$/.test(value) && value.length <= 255
    ? value
    : null;
}

/** Carries consent-approved attribution signals into the Fastrr order. */
export function metaFastrrCheckoutAttributes(): Record<string, string> {
  const attributes: Record<string, string> = {
    [META_FASTRR_ATTRIBUTES.PROVIDER]: 'fastrr',
  };
  if (!metaTrackingAllowed()) return attributes;

  attributes[META_FASTRR_ATTRIBUTES.CONSENT] = '1';
  const fbp = validMetaBrowserId(cookieValue('_fbp'));
  let fbc = validMetaBrowserId(cookieValue('_fbc'));
  if (!fbc && typeof window !== 'undefined') {
    const clickId = new URL(window.location.href).searchParams.get('fbclid');
    if (clickId && /^[A-Za-z0-9._-]{1,200}$/.test(clickId)) {
      fbc = `fb.1.${Date.now()}.${clickId}`;
    }
  }
  if (fbp) attributes[META_FASTRR_ATTRIBUTES.FBP] = fbp;
  if (fbc) attributes[META_FASTRR_ATTRIBUTES.FBC] = fbc;
  if (typeof window !== 'undefined' && /^https:\/\//.test(window.location.href)) {
    attributes[META_FASTRR_ATTRIBUTES.SOURCE_URL] = window.location.href.slice(0, 1000);
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    attributes[META_FASTRR_ATTRIBUTES.USER_AGENT] = navigator.userAgent.slice(0, 500);
  }
  return attributes;
}

export function metaContentId(shopifyId: string) {
  const gid = /^gid:\/\/shopify\/(?:Product|ProductVariant)\/(\d+)$/.exec(
    shopifyId,
  );
  return gid?.[1] ?? (/^\d+$/.test(shopifyId) ? shopifyId : null);
}

export function metaCommerceParameters(payload: MetaCommercePayload) {
  return {
    content_ids: payload.items.map(({id}) => id),
    content_type: 'product',
    contents: payload.items.map(({id, quantity, itemPrice}) => ({
      id,
      quantity,
      item_price: itemPrice,
    })),
    currency: payload.currency,
    num_items: payload.items.reduce((total, item) => total + item.quantity, 0),
    value: payload.value,
    ...(payload.items.length === 1 && payload.items[0].name
      ? {content_name: payload.items[0].name}
      : {}),
    ...(payload.items.length === 1 && payload.items[0].category
      ? {content_category: payload.items[0].category}
      : {}),
    ...(payload.orderId ? {order_id: payload.orderId} : {}),
  };
}

export function parseMetaCommercePayload(value: unknown): MetaCommercePayload | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MetaCommercePayload>;
  if (
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0 ||
    candidate.items.length > 100 ||
    typeof candidate.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(candidate.currency) ||
    typeof candidate.value !== 'number' ||
    !Number.isFinite(candidate.value) ||
    candidate.value < 0
  ) {
    return null;
  }

  const items = candidate.items.filter(
    (item): item is MetaCommerceItem =>
      Boolean(
        item &&
          typeof item.id === 'string' &&
          /^\d+$/.test(item.id) &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          typeof item.itemPrice === 'number' &&
          Number.isFinite(item.itemPrice) &&
          item.itemPrice >= 0 &&
          (item.name === undefined ||
            (typeof item.name === 'string' && item.name.length <= 255)) &&
          (item.category === undefined ||
            (typeof item.category === 'string' && item.category.length <= 255)) &&
          (item.brand === undefined ||
            (typeof item.brand === 'string' && item.brand.length <= 255)),
      ),
  );
  if (items.length !== candidate.items.length) return null;

  return {
    currency: candidate.currency,
    value: candidate.value,
    items,
    ...(typeof candidate.eventId === 'string' && candidate.eventId.length <= 100
      ? {eventId: candidate.eventId}
      : {}),
    ...(typeof candidate.orderId === 'string' && candidate.orderId.length <= 100
      ? {orderId: candidate.orderId}
      : {}),
  };
}

function pendingPurchaseKey(payload: MetaCommercePayload) {
  return payload.eventId ?? payload.orderId ?? JSON.stringify(payload);
}

export function pendingMetaPurchases(): MetaCommercePayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(
      window.sessionStorage.getItem(META_PENDING_PURCHASES_KEY) ?? '[]',
    );
    if (!Array.isArray(stored)) return [];
    return stored
      .map(parseMetaCommercePayload)
      .filter((payload): payload is MetaCommercePayload => Boolean(payload))
      .slice(-10);
  } catch {
    return [];
  }
}

/**
 * Persists a verified browser Purchase until the Pixel subscriber and consent
 * state are ready. This survives the full-page Razorpay success redirect.
 */
export function queueMetaPurchase(value: unknown) {
  const payload = parseMetaCommercePayload(value);
  if (!payload || typeof window === 'undefined') return false;
  try {
    const key = pendingPurchaseKey(payload);
    const queued = pendingMetaPurchases().filter(
      (candidate) => pendingPurchaseKey(candidate) !== key,
    );
    window.sessionStorage.setItem(
      META_PENDING_PURCHASES_KEY,
      JSON.stringify([...queued, payload].slice(-10)),
    );
    document.dispatchEvent(new Event(META_PURCHASE_READY_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function acknowledgeMetaPurchase(payload: MetaCommercePayload) {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingPurchaseKey(payload);
    const remaining = pendingMetaPurchases().filter(
      (candidate) => pendingPurchaseKey(candidate) !== key,
    );
    if (remaining.length) {
      window.sessionStorage.setItem(
        META_PENDING_PURCHASES_KEY,
        JSON.stringify(remaining),
      );
    } else {
      window.sessionStorage.removeItem(META_PENDING_PURCHASES_KEY);
    }
  } catch {
    // Tracking storage must never affect order confirmation rendering.
  }
}

export const META_PIXEL_CSP = {
  scriptSrc: ['https://connect.facebook.net'],
  connectSrc: [
    'https://connect.facebook.net',
    'https://www.facebook.com',
    // Meta OpenBridge / Conversions API Gateway endpoints configured for this pixel.
    'https://mpc2-prod-23-is5qnl632q-ue.a.run.app',
    'https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws',
  ],
  imgSrc: ['https://www.facebook.com'],
} as const;

type ShopifyOrderAddress = {
  city?: unknown;
  country_code?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  phone?: unknown;
  province_code?: unknown;
  zip?: unknown;
};

type ShopifyOrderWebhook = {
  billing_address?: ShopifyOrderAddress | null;
  created_at?: unknown;
  currency?: unknown;
  customer?: {
    email?: unknown;
    phone?: unknown;
    first_name?: unknown;
    last_name?: unknown;
  } | null;
  email?: unknown;
  financial_status?: unknown;
  gateway_names?: unknown;
  id?: unknown;
  line_items?: unknown;
  name?: unknown;
  note_attributes?: unknown;
  order_status_url?: unknown;
  payment_gateway_names?: unknown;
  phone?: unknown;
  processed_at?: unknown;
  shipping_address?: ShopifyOrderAddress | null;
  total_price?: unknown;
  updated_at?: unknown;
};

export type MetaServerEvent = {
  action_source: 'website';
  custom_data: ReturnType<typeof metaCommerceParameters>;
  event_id: string;
  event_name: 'Purchase';
  event_source_url?: string;
  event_time: number;
  user_data: Record<string, string | string[]>;
};

function stringValue(value: unknown, maxLength = 255) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value
    : null;
}

function orderAttributes(value: unknown) {
  const attributes = new Map<string, string>();
  if (!Array.isArray(value)) return attributes;

  const addNestedAttributes = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const wrapper = parsed as Record<string, unknown>;
      const nested =
        wrapper.cartAttributes &&
        typeof wrapper.cartAttributes === 'object' &&
        !Array.isArray(wrapper.cartAttributes)
          ? (wrapper.cartAttributes as Record<string, unknown>)
          : wrapper;
      for (const key of Object.values(META_FASTRR_ATTRIBUTES)) {
        const nestedValue = stringValue(nested[key], 1000);
        if (nestedValue) attributes.set(key, nestedValue);
      }
    } catch {
      // Ordinary Shopify note attributes are not JSON.
    }
  };

  for (const attribute of value) {
    if (!attribute || typeof attribute !== 'object') continue;
    const candidate = attribute as {name?: unknown; value?: unknown};
    const name = stringValue(candidate.name);
    const attributeValue = stringValue(candidate.value, 1000);
    if (!name || !attributeValue) continue;
    attributes.set(name, attributeValue);
    if (name === 'cartAttributes') addNestedAttributes(attributeValue);
  }

  return attributes;
}

function isCodOrder(order: ShopifyOrderWebhook) {
  const gateways = [order.gateway_names, order.payment_gateway_names]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return gateways.includes('cash on delivery') || /(^|\W)cod($|\W)/.test(gateways);
}

function normalized(value: unknown) {
  const text = stringValue(value);
  return text ? text.trim().toLowerCase().normalize('NFKC') : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function hashed(value: string | null) {
  return value ? [await sha256(value)] : null;
}

/** Builds a consent-gated CAPI Purchase from orders/create or orders/paid. */
export async function metaPurchaseFromShopifyOrder(
  value: unknown,
  topic: string,
): Promise<MetaServerEvent | null> {
  if (!value || typeof value !== 'object') return null;
  const order = value as ShopifyOrderWebhook;
  const attributes = orderAttributes(order.note_attributes);
  if (
    attributes.get(META_FASTRR_ATTRIBUTES.PROVIDER) !== 'fastrr' ||
    attributes.get(META_FASTRR_ATTRIBUTES.CONSENT) !== '1'
  ) {
    return null;
  }
  if (topic === 'orders/create') {
    if (order.financial_status !== 'paid' && !isCodOrder(order)) return null;
  } else if (topic !== 'orders/paid') {
    return null;
  }

  const numericOrderId =
    typeof order.id === 'number' && Number.isSafeInteger(order.id)
      ? String(order.id)
      : stringValue(order.id, 100);
  const currency = stringValue(order.currency, 3);
  const valueAmount = Number(order.total_price);
  const occurredAt = stringValue(
    topic === 'orders/paid'
      ? (order.processed_at ?? order.updated_at ?? order.created_at)
      : order.created_at,
    100,
  );
  const eventTime = occurredAt ? Math.floor(Date.parse(occurredAt) / 1000) : NaN;
  if (
    !numericOrderId ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency) ||
    !Number.isFinite(valueAmount) ||
    valueAmount < 0 ||
    !Number.isSafeInteger(eventTime)
  ) {
    return null;
  }

  if (!Array.isArray(order.line_items) || order.line_items.length === 0) return null;
  const items: MetaCommerceItem[] = order.line_items.flatMap((line) => {
    if (!line || typeof line !== 'object') return [];
    const item = line as Record<string, unknown>;
    const id =
      typeof item.variant_id === 'number' && Number.isSafeInteger(item.variant_id)
        ? String(item.variant_id)
        : stringValue(item.variant_id, 100);
    const quantity = Number(item.quantity);
    const itemPrice = Number(item.price);
    if (
      !id ||
      !/^\d+$/.test(id) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(itemPrice) ||
      itemPrice < 0
    ) {
      return [];
    }
    const title = stringValue(item.title);
    const variantTitle = stringValue(item.variant_title);
    const brand = stringValue(item.vendor);
    return [
      {
        id,
        quantity,
        itemPrice,
        ...(title
          ? {name: variantTitle ? `${title} - ${variantTitle}`.slice(0, 255) : title}
          : {}),
        ...(brand ? {brand} : {}),
      },
    ];
  });
  if (items.length !== order.line_items.length) return null;

  const address = order.billing_address ?? order.shipping_address ?? {};
  const email = normalized(order.email ?? order.customer?.email);
  const phoneValue = normalized(order.phone ?? address.phone ?? order.customer?.phone);
  const phone = phoneValue?.replace(/\D/g, '') || null;
  const userDataEntries = await Promise.all([
    ['em', await hashed(email)] as const,
    ['ph', await hashed(phone)] as const,
    [
      'fn',
      await hashed(normalized(address.first_name ?? order.customer?.first_name)),
    ] as const,
    [
      'ln',
      await hashed(normalized(address.last_name ?? order.customer?.last_name)),
    ] as const,
    [
      'ct',
      await hashed(normalized(address.city)?.replace(/[^\p{L}\p{N}]/gu, '') ?? null),
    ] as const,
    ['st', await hashed(normalized(address.province_code))] as const,
    ['zp', await hashed(normalized(address.zip)?.replace(/\s/g, '') ?? null)] as const,
    ['country', await hashed(normalized(address.country_code))] as const,
    ['external_id', await hashed(`shopify_order_${numericOrderId}`)] as const,
  ]);
  const userData: Record<string, string | string[]> = {};
  for (const [key, hashedValue] of userDataEntries) {
    if (hashedValue) userData[key] = hashedValue;
  }
  const fbp = validMetaBrowserId(attributes.get(META_FASTRR_ATTRIBUTES.FBP) ?? null);
  const fbc = validMetaBrowserId(attributes.get(META_FASTRR_ATTRIBUTES.FBC) ?? null);
  const userAgent = stringValue(
    attributes.get(META_FASTRR_ATTRIBUTES.USER_AGENT),
    500,
  );
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (userAgent) userData.client_user_agent = userAgent;

  const commerce: MetaCommercePayload = {
    currency,
    value: valueAmount,
    items,
    orderId: stringValue(order.name, 100) ?? numericOrderId,
  };
  const sourceUrl = stringValue(
    attributes.get(META_FASTRR_ATTRIBUTES.SOURCE_URL) ?? order.order_status_url,
    1000,
  );
  return {
    event_name: 'Purchase',
    event_time: eventTime,
    event_id: `meta_purchase_shopify_${numericOrderId}`.slice(0, 100),
    action_source: 'website',
    ...(sourceUrl && /^https:\/\//.test(sourceUrl)
      ? {event_source_url: sourceUrl}
      : {}),
    user_data: userData,
    custom_data: metaCommerceParameters(commerce),
  };
}

export async function sendMetaServerEvent(
  env: Pick<
    Env,
    | 'META_CONVERSIONS_API_ACCESS_TOKEN'
    | 'META_GRAPH_API_VERSION'
    | 'META_TEST_EVENT_CODE'
    | 'PUBLIC_META_PIXEL_ID'
  >,
  event: MetaServerEvent,
  request: typeof fetch = fetch,
) {
  const pixelId = resolveMetaPixelId(env.PUBLIC_META_PIXEL_ID);
  const accessToken = env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  const apiVersion = env.META_GRAPH_API_VERSION?.trim() || 'v24.0';
  if (!pixelId || !accessToken || !/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error('Meta Conversions API is not configured');
  }

  const response = await request(
    `https://graph.facebook.com/${apiVersion}/${pixelId}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        data: [event],
        ...(env.META_TEST_EVENT_CODE?.trim()
          ? {test_event_code: env.META_TEST_EVENT_CODE.trim()}
          : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Meta Conversions API rejected the event (${response.status})`);
  }
}
