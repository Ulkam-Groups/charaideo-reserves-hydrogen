import RazorpayOxygen from './razorpay-oxygen.server.ts';
import {
  adminCredentials,
  adminGraphql,
  validateRazorpayOrderForShopify,
  type RazorpayMagicOrderDetails,
} from './razorpay-order.server.ts';
import {razorpayCredentials} from './razorpay.server.ts';

type RazorpayAddress = NonNullable<
  RazorpayMagicOrderDetails['customer_details']
>['shipping_address'];

export async function abandonedWebhookSecretMatches(
  expected: string,
  received: string | null,
) {
  if (!received) return false;
  const encoder = new TextEncoder();
  const [expectedHash, receivedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const receivedBytes = new Uint8Array(receivedHash);
  let mismatch = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    mismatch |= expectedBytes[index] ^ receivedBytes[index];
  }
  return mismatch === 0;
}

function text(value: unknown, max = 255) {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result && result.length <= max ? result : undefined;
}

function mailingAddress(value: RazorpayAddress) {
  if (!value) return undefined;
  const countryCode = text(value.country, 2)?.toUpperCase();
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return undefined;
  const names = (text(value.name, 150) ?? '').split(/\s+/).filter(Boolean);
  const firstName = names.shift();
  const lastName = names.join(' ') || undefined;
  return {
    ...(firstName ? {firstName} : {}),
    ...(lastName ? {lastName} : {}),
    ...(text(value.line1) ? {address1: text(value.line1)} : {}),
    ...(text(value.line2) ? {address2: text(value.line2)} : {}),
    ...(text(value.city, 100) ? {city: text(value.city, 100)} : {}),
    ...(text(value.state, 100) ? {province: text(value.state, 100)} : {}),
    ...(text(value.zipcode, 20) ? {zip: text(value.zipcode, 20)} : {}),
    ...(text(value.contact, 30) ? {phone: text(value.contact, 30)} : {}),
    countryCode,
  };
}

type DocumentedAbandonedLine = {
  variantId: string;
  quantity: number;
};

type DocumentedAbandonedPayload = {
  token: string;
  cartToken: string;
  currency: 'INR';
  email?: string;
  phone?: string;
  abandonedCheckoutUrl?: string;
  lineItemsTotal: number;
  lineItems: DocumentedAbandonedLine[];
  shippingAddress?: ReturnType<typeof mailingAddress>;
  utm?: string;
  promotions?: string;
};

type AnalyticsAbandonment = {
  timeSinceOpen?: number;
  email?: string;
  phone?: string;
  shippingAddress?: ReturnType<typeof mailingAddress>;
};

function positiveInteger(value: unknown) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function compactJson(value: unknown, max = 255) {
  if (value === undefined || value === null) return undefined;
  const result = JSON.stringify(value);
  return result.length <= max ? result : undefined;
}

function documentedMailingAddress(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const address = value as Record<string, unknown>;
  const countryCode = text(address.Country_code, 2)?.toUpperCase();
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return undefined;
  return {
    ...(text(address.First_name, 150) ? {firstName: text(address.First_name, 150)} : {}),
    ...(text(address.Last_name, 150) ? {lastName: text(address.Last_name, 150)} : {}),
    ...(text(address.Address1) ? {address1: text(address.Address1)} : {}),
    ...(text(address.Address2) ? {address2: text(address.Address2)} : {}),
    ...(text(address.City, 100) ? {city: text(address.City, 100)} : {}),
    ...(text(address.Province, 100) ? {province: text(address.Province, 100)} : {}),
    ...(text(address.Zip, 20) ? {zip: text(address.Zip, 20)} : {}),
    ...(text(address.Phone, 30) ? {phone: text(address.Phone, 30)} : {}),
    countryCode,
  };
}

export function parseRazorpayAnalyticsAbandonment(
  payload: unknown,
): AnalyticsAbandonment | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (value.event !== 'checkout_abandoned') return null;
  const elapsed = value.time_since_open;
  if (
    elapsed !== undefined &&
    (typeof elapsed !== 'number' ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed > 86_400_000)
  ) {
    return null;
  }
  const countryCode = text(value.country_name, 2)?.toUpperCase();
  const shippingAddress =
    countryCode && /^[A-Z]{2}$/.test(countryCode)
      ? {
          ...(text(value.first_name, 150)
            ? {firstName: text(value.first_name, 150)}
            : {}),
          ...(text(value.last_name, 150)
            ? {lastName: text(value.last_name, 150)}
            : {}),
          ...(text(value.line1) ? {address1: text(value.line1)} : {}),
          ...(text(value.line2) ? {address2: text(value.line2)} : {}),
          ...(text(value.city, 100) ? {city: text(value.city, 100)} : {}),
          ...(text(value.state, 100) ? {province: text(value.state, 100)} : {}),
          ...(text(value.zipcode, 20) ? {zip: text(value.zipcode, 20)} : {}),
          ...(text(value.phone, 30) ? {phone: text(value.phone, 30)} : {}),
          countryCode,
        }
      : undefined;
  const email = text(value.email, 254);
  const phone = text(value.phone, 30);
  return {
    ...(typeof elapsed === 'number' ? {timeSinceOpen: Math.round(elapsed)} : {}),
    ...(email ? {email} : {}),
    ...(phone ? {phone} : {}),
    ...(shippingAddress ? {shippingAddress} : {}),
  };
}

export function parseDocumentedAbandonedRazorpayPayload(
  payload: unknown,
): DocumentedAbandonedPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const token = text(value.token, 100);
  const cartToken = text(value.cart_token, 150);
  const currency = text(value.currency, 3);
  const lineItemsTotal = positiveInteger(value.line_items_total);
  if (
    !token ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(token) ||
    !cartToken ||
    !/^[A-Za-z0-9_-]{8,150}$/.test(cartToken) ||
    currency !== 'INR' ||
    !lineItemsTotal
  ) {
    return null;
  }
  if (!Array.isArray(value.line_items) || !value.line_items.length || value.line_items.length > 250) {
    return null;
  }
  const lineItems: DocumentedAbandonedLine[] = [];
  for (const entry of value.line_items) {
    if (!entry || typeof entry !== 'object') return null;
    const line = entry as Record<string, unknown>;
    const variantId = text(line.variant_id, 30);
    const quantity = positiveInteger(line.quantity);
    if (!variantId || !/^\d+$/.test(variantId) || !quantity) return null;
    lineItems.push({variantId, quantity});
  }
  const customer =
    value.customer && typeof value.customer === 'object'
      ? (value.customer as Record<string, unknown>)
      : undefined;
  const email = text(customer?.email ?? value.email, 254);
  const phone = text(value.phone, 30);
  return {
    token,
    cartToken,
    currency: 'INR',
    ...(email ? {email} : {}),
    ...(phone ? {phone} : {}),
    ...(text(value.abandoned_checkout_url, 255)
      ? {abandonedCheckoutUrl: text(value.abandoned_checkout_url, 255)}
      : {}),
    lineItemsTotal,
    lineItems,
    shippingAddress: documentedMailingAddress(customer?.Shipping_address),
    utm: compactJson(value.utm_parameters),
    promotions: compactJson(value.promotions),
  };
}

export async function updateDocumentedAbandonedRazorpayDraft({
  env,
  payload,
  eventId,
  fetcher = fetch,
}: {
  env: Env;
  payload: unknown;
  eventId?: string;
  fetcher?: typeof fetch;
}) {
  const parsed = parseDocumentedAbandonedRazorpayPayload(payload);
  const credentials = adminCredentials(env);
  if (!parsed || !credentials) throw new Error('Abandoned checkout payload is invalid');

  const tokenTag = `razorpay-abandonment-${parsed.token}`;
  const existing = await adminGraphql<{
    draftOrders: {
      nodes: Array<{id: string; status: string; order: {id: string} | null}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `query ExistingAbandonedRazorpayRecovery($query: String!) {
      draftOrders(first: 2, query: $query, sortKey: CREATED_AT, reverse: true) {
        nodes { id status order { id } }
      }
    }`,
    variables: {query: `tag:${tokenTag}`},
  });
  const prior = existing.draftOrders.nodes[0];
  if (prior) {
    return {
      draftOrderId: prior.id,
      token: parsed.token,
      created: false as const,
    };
  }

  const attributes = new Map<string, string>([
    ['checkout_provider', 'razorpay'],
    ['checkout_state', 'abandoned'],
    ['razorpay_abandonment_token', parsed.token],
    ['razorpay_cart_token', parsed.cartToken],
    ['razorpay_line_items_total', String(parsed.lineItemsTotal)],
  ]);
  if (parsed.abandonedCheckoutUrl) {
    attributes.set('razorpay_abandoned_checkout_url', parsed.abandonedCheckoutUrl);
  }
  if (parsed.utm) attributes.set('razorpay_utm', parsed.utm);
  if (parsed.promotions) attributes.set('razorpay_promotions', parsed.promotions);
  const safeEventId = text(eventId, 100);
  if (safeEventId) attributes.set('razorpay_abandonment_event_id', safeEventId);

  const created = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: {id: string; status: string; order: {id: string} | null} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation CreateAbandonedRazorpayRecovery($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id status order { id } }
        userErrors { field message }
      }
    }`,
    variables: {
      input: {
        lineItems: parsed.lineItems.map(({variantId, quantity}) => ({
          variantId: `gid://shopify/ProductVariant/${variantId}`,
          quantity,
        })),
        presentmentCurrencyCode: parsed.currency,
        visibleToCustomer: false,
        allowDiscountCodesInCheckout: false,
        tags: [
          'razorpay',
          'magic-checkout',
          'abandoned-checkout',
          'abandoned-recovery',
          tokenTag,
        ],
        note: 'Razorpay Magic Checkout abandoned recovery',
        ...(parsed.shippingAddress ? {shippingAddress: parsed.shippingAddress} : {}),
        ...(parsed.email && parsed.email.toLowerCase() !== 'void@razorpay.com'
          ? {email: parsed.email}
          : {}),
        ...(parsed.phone ? {phone: parsed.phone} : {}),
        customAttributes: Array.from(attributes, ([key, value]) => ({key, value})),
      },
    },
  });
  const draft = created.draftOrderCreate.draftOrder;
  if (
    created.draftOrderCreate.userErrors.length ||
    !draft ||
    !/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draft.id) ||
    draft.status !== 'OPEN' ||
    draft.order
  ) {
    throw new Error('Shopify rejected the abandoned recovery draft');
  }
  return {draftOrderId: draft.id, token: parsed.token, created: true as const};
}

export function abandonedRazorpayOrderId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as {
    order_id?: unknown;
    order?: {id?: unknown};
    payload?: {
      order_id?: unknown;
      order?: {entity?: {id?: unknown}};
      payment?: {entity?: {order_id?: unknown}};
    };
  };
  const candidates = [
    value.order_id,
    value.order?.id,
    value.payload?.order_id,
    value.payload?.order?.entity?.id,
    value.payload?.payment?.entity?.order_id,
  ];
  const orderId = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && /^order_[A-Za-z0-9]+$/.test(candidate),
  );
  return orderId ?? null;
}

export async function updateAbandonedRazorpayDraft({
  env,
  orderId,
  eventId,
  analyticsPayload,
  expectedDraftOrderId,
  fetcher = fetch,
}: {
  env: Env;
  orderId: string;
  eventId?: string;
  analyticsPayload?: unknown;
  expectedDraftOrderId?: string;
  fetcher?: typeof fetch;
}) {
  const razorpayAuth = razorpayCredentials(env);
  const shopifyAuth = adminCredentials(env);
  if (!razorpayAuth || !shopifyAuth) throw new Error('Abandoned checkout is not configured');

  const razorpay = new RazorpayOxygen({
    key_id: razorpayAuth.keyId,
    key_secret: razorpayAuth.keySecret,
    fetcher,
  });
  const {order} = validateRazorpayOrderForShopify(
    await razorpay.orders.fetch(orderId),
    orderId,
  );
  if (
    (order.status !== 'created' && order.status !== 'attempted') ||
    order.amount_paid !== 0 ||
    order.amount_due !== order.amount
  ) {
    return {draftOrderId: null, razorpayOrderId: order.id, updated: false as const};
  }
  const draftOrderId = order.notes.shopify_draft_order_id;
  if (
    typeof draftOrderId !== 'string' ||
    !/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draftOrderId)
  ) {
    throw new Error('Razorpay order has no valid Shopify draft order anchor');
  }

  if (expectedDraftOrderId && draftOrderId !== expectedDraftOrderId) {
    throw new Error('Razorpay order does not match the checkout session draft');
  }

  const analytics = analyticsPayload
    ? parseRazorpayAnalyticsAbandonment(analyticsPayload)
    : null;
  if (analyticsPayload && !analytics) {
    throw new Error('Razorpay analytics abandonment payload is invalid');
  }
  const shippingAddress =
    analytics?.shippingAddress ?? mailingAddress(order.customer_details?.shipping_address);
  const billingAddress = mailingAddress(order.customer_details?.billing_address);
  const email = analytics?.email ?? text(order.customer_details?.email, 254);
  const phone = analytics?.phone ?? text(order.customer_details?.contact, 30);
  const shippingFee = Number.isSafeInteger(order.shipping_fee) ? order.shipping_fee! : 0;
  const source = text(order.notes.source, 20);
  const safeEventId = text(eventId, 100);

  const current = await adminGraphql<{
    draftOrder: {
      id: string;
      status: string;
      order: {id: string} | null;
      customAttributes: Array<{key: string; value: string}>;
    } | null;
  }>({
    credentials: shopifyAuth,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `query AbandonedRazorpayDraft($id: ID!) {
      draftOrder(id: $id) { id status order { id } customAttributes { key value } }
    }`,
    variables: {id: draftOrderId},
  });
  if (!current.draftOrder || current.draftOrder.id !== draftOrderId) {
    throw new Error('Shopify draft order anchor was not found');
  }
  if (current.draftOrder.status !== 'OPEN' || current.draftOrder.order) {
    return {draftOrderId, razorpayOrderId: order.id, updated: false as const};
  }
  const attributes = new Map(
    current.draftOrder.customAttributes.map(({key, value}) => [key, value]),
  );
  attributes.set('checkout_provider', 'razorpay');
  if (source) attributes.set('checkout_source', source);
  attributes.set('razorpay_order_id', order.id);
  if (safeEventId) attributes.set('razorpay_abandonment_event_id', safeEventId);
  if (analytics) attributes.set('razorpay_abandonment_source', 'mx-analytics');
  if (analytics?.timeSinceOpen !== undefined) {
    attributes.set('razorpay_time_since_open_ms', String(analytics.timeSinceOpen));
  }

  const result = await adminGraphql<{
    draftOrderUpdate: {
      draftOrder: {id: string; status: string; order: {id: string} | null} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials: shopifyAuth,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation UpdateAbandonedRazorpayDraft($id: ID!, $input: DraftOrderInput!) {
      draftOrderUpdate(id: $id, input: $input) {
        draftOrder { id status order { id } }
        userErrors { field message }
      }
    }`,
    variables: {
      id: draftOrderId,
      input: {
        ...(shippingAddress ? {shippingAddress} : {}),
        ...(billingAddress ? {billingAddress} : {}),
        ...(email && email.toLowerCase() !== 'void@razorpay.com' ? {email} : {}),
        ...(phone ? {phone} : {}),
        ...(shippingFee > 0
          ? {
              shippingLine: {
                title: 'Standard delivery',
                priceWithCurrency: {
                  amount: (shippingFee / 100).toFixed(2),
                  currencyCode: 'INR',
                },
              },
            }
          : {}),
        customAttributes: Array.from(attributes, ([key, value]) => ({key, value})),
        visibleToCustomer: false,
      },
    },
  });

  const draft = result.draftOrderUpdate.draftOrder;
  if (
    result.draftOrderUpdate.userErrors.length ||
    !draft ||
    draft.id !== draftOrderId ||
    draft.status !== 'OPEN' ||
    draft.order
  ) {
    throw new Error('Shopify rejected the abandoned draft order update');
  }

  const tagged = await adminGraphql<{
    tagsAdd: {
      node: {id: string} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials: shopifyAuth,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation TagAbandonedRazorpayDraft($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }`,
    variables: {
      id: draftOrderId,
      tags: ['razorpay', 'magic-checkout', 'checkout-draft', 'abandoned-checkout'],
    },
  });
  if (tagged.tagsAdd.userErrors.length || tagged.tagsAdd.node?.id !== draftOrderId) {
    throw new Error('Shopify rejected the abandoned draft order tags');
  }
  return {draftOrderId, razorpayOrderId: order.id, updated: true as const};
}
