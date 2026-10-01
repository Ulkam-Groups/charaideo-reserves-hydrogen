import RazorpayOxygen from './razorpay-oxygen.server.ts';
import {
  decodeRazorpayCheckoutSnapshot,
  inrToPaise,
  type RazorpayCheckoutSnapshotLine,
  type RazorpayOrderLine,
} from './razorpay.ts';
import {razorpayCredentials} from './razorpay.server.ts';

const ADMIN_API_VERSION = '2026-07';

type RazorpayAddress = {
  city?: unknown;
  contact?: unknown;
  country?: unknown;
  line1?: unknown;
  line2?: unknown;
  name?: unknown;
  state?: unknown;
  zipcode?: unknown;
};

export type RazorpayMagicOrderDetails = {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  line_items_total: number;
  shipping_fee?: number;
  cod_fee?: number;
  notes: Record<string, unknown>;
  customer_details?: {
    contact?: unknown;
    email?: unknown;
    shipping_address?: RazorpayAddress;
    billing_address?: RazorpayAddress;
  };
  tax_details?: {taxes_included?: unknown};
};

export type RazorpayPaymentDetails = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method?: string;
};

type ShopifyAdminCredentials = {
  domain: string;
  clientId: string;
  clientSecret: string;
};

type RazorpayReconciliationFailureCode =
  | 'SHOPIFY_AUTHENTICATION_FAILED'
  | 'SHOPIFY_GRAPHQL_THROTTLED'
  | 'SHOPIFY_ORDER_WRITE_FAILED'
  | 'SHOPIFY_REQUIRED_SCOPE_MISSING';

export class RazorpayReconciliationError extends Error {
  readonly code?: RazorpayReconciliationFailureCode;

  constructor(message: string, code?: RazorpayReconciliationFailureCode) {
    super(message);
    this.name = 'RazorpayReconciliationError';
    this.code = code;
  }
}

const RAZORPAY_FINALIZATION_RETRY_DELAYS_MS = [250, 750, 1_500] as const;

function isPendingRazorpayFinalization(error: unknown) {
  return (
    error instanceof RazorpayReconciliationError &&
    (error.message === 'Razorpay payment is not captured' ||
      error.message === 'Razorpay order is not payable')
  );
}

export async function retryPendingRazorpayFinalization<T>(
  operation: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  for (const delay of [0, ...RAZORPAY_FINALIZATION_RETRY_DELAYS_MS]) {
    if (delay) await wait(delay);
    try {
      return await operation();
    } catch (error) {
      if (!isPendingRazorpayFinalization(error) || delay === 1_500) throw error;
    }
  }
  throw new RazorpayReconciliationError('Razorpay payment is not captured');
}

export function razorpayVerificationFailureCode(error: unknown) {
  if (!(error instanceof RazorpayReconciliationError)) {
    return 'CHECKOUT_VERIFICATION_FAILED';
  }
  if (error.code) return error.code;
  if (isPendingRazorpayFinalization(error)) return 'RAZORPAY_PAYMENT_NOT_FINAL';
  if (error.message.startsWith('Shopify')) return 'SHOPIFY_ORDER_WRITE_FAILED';
  return 'RAZORPAY_ORDER_DATA_INVALID';
}

function adminCredentials(env: Env): ShopifyAdminCredentials | null {
  const domain = (env.SHOPIFY_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN)?.trim();
  const clientId = env.SHOPIFY_ADMIN_CLIENT_ID?.trim();
  const clientSecret = env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim();
  if (
    !domain ||
    !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain) ||
    !clientId ||
    !clientSecret
  ) {
    return null;
  }
  return {domain, clientId, clientSecret};
}

export function razorpayDraftOrderAnchorEnabled(env: Env) {
  return env.RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED?.trim().toLowerCase() === 'true';
}

function integer(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RazorpayReconciliationError(`Invalid Razorpay ${name}`);
  }
  return value as number;
}

function paiseToRupees(value: number) {
  return (value / 100).toFixed(2);
}

function stringValue(value: unknown, maximum = 255): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maximum)
    : undefined;
}

function mailingAddress(value: RazorpayAddress | undefined) {
  if (!value) return undefined;
  const countryCode = stringValue(value.country, 2)?.toUpperCase();
  const name = stringValue(value.name, 150) ?? '';
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts.shift();
  const lastName = parts.join(' ') || undefined;
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return undefined;
  return {
    ...(firstName ? {firstName} : {}),
    ...(lastName ? {lastName} : {}),
    ...(stringValue(value.line1) ? {address1: stringValue(value.line1)} : {}),
    ...(stringValue(value.line2) ? {address2: stringValue(value.line2)} : {}),
    ...(stringValue(value.city, 100) ? {city: stringValue(value.city, 100)} : {}),
    ...(stringValue(value.state, 100) ? {province: stringValue(value.state, 100)} : {}),
    ...(stringValue(value.zipcode, 20) ? {zip: stringValue(value.zipcode, 20)} : {}),
    ...(stringValue(value.contact, 30) ? {phone: stringValue(value.contact, 30)} : {}),
    countryCode,
  };
}

export function validateRazorpayOrderForShopify(
  value: unknown,
  expectedOrderId: string,
): {order: RazorpayMagicOrderDetails; lines: RazorpayCheckoutSnapshotLine[]} {
  if (!value || typeof value !== 'object') {
    throw new RazorpayReconciliationError('Invalid Razorpay order');
  }
  const order = value as RazorpayMagicOrderDetails;
  if (order.id !== expectedOrderId || order.currency !== 'INR') {
    throw new RazorpayReconciliationError('Razorpay order identity mismatch');
  }
  const notes = order.notes && typeof order.notes === 'object' ? order.notes : {};
  const lines = decodeRazorpayCheckoutSnapshot(notes);
  if (!lines?.length) {
    throw new RazorpayReconciliationError('Razorpay order has no checkout snapshot');
  }
  const lineTotal = lines.reduce(
    (total, line) => total + line.unitPricePaise * line.quantity,
    0,
  );
  const documentedLineTotal = integer(order.line_items_total, 'line total');
  const shippingFee = integer(order.shipping_fee ?? 0, 'shipping fee');
  const codFee = integer(order.cod_fee ?? 0, 'COD fee');
  const amount = integer(order.amount, 'amount');
  if (lineTotal !== documentedLineTotal || amount !== lineTotal + shippingFee + codFee) {
    throw new RazorpayReconciliationError('Razorpay order total mismatch');
  }
  return {order, lines};
}

export function validateCapturedRazorpayPayment(
  value: unknown,
  order: RazorpayMagicOrderDetails,
): RazorpayPaymentDetails {
  if (!value || typeof value !== 'object') {
    throw new RazorpayReconciliationError('Invalid Razorpay payment');
  }
  const payment = value as RazorpayPaymentDetails;
  if (
    !/^pay_[A-Za-z0-9]+$/.test(payment.id) ||
    payment.order_id !== order.id ||
    payment.currency !== 'INR' ||
    payment.status !== 'captured' ||
    payment.captured !== true ||
    integer(payment.amount, 'payment amount') !== order.amount ||
    integer(order.amount_paid, 'paid amount') !== order.amount ||
    integer(order.amount_due, 'amount due') !== 0 ||
    order.status !== 'paid'
  ) {
    throw new RazorpayReconciliationError('Razorpay payment is not captured');
  }
  return payment;
}

export function buildShopifyOrderInput({
  order,
  lines,
  payment,
  test,
}: {
  order: RazorpayMagicOrderDetails;
  lines: RazorpayCheckoutSnapshotLine[];
  payment: RazorpayPaymentDetails | null;
  test: boolean;
}) {
  const shippingFee = integer(order.shipping_fee ?? 0, 'shipping fee');
  const codFee = integer(order.cod_fee ?? 0, 'COD fee');
  const customer = order.customer_details;
  const shippingAddress = mailingAddress(customer?.shipping_address);
  if (!shippingAddress) {
    throw new RazorpayReconciliationError('Razorpay shipping address is missing');
  }
  const billingAddress = mailingAddress(customer?.billing_address);
  const email = stringValue(customer?.email, 254);
  const phone = stringValue(customer?.contact, 30);
  const money = (paise: number) => ({
    shopMoney: {amount: paiseToRupees(paise), currencyCode: 'INR'},
  });

  return {
    lineItems: lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      priceSet: money(line.unitPricePaise),
      requiresShipping: true,
    })),
    ...(shippingFee + codFee > 0
      ? {
          shippingLines: [
            {
              title: codFee ? 'Standard delivery and COD fee' : 'Standard delivery',
              code: 'razorpay-standard',
              source: 'Razorpay Magic Checkout',
              priceSet: money(shippingFee + codFee),
            },
          ],
        }
      : {}),
    shippingAddress,
    ...(billingAddress ? {billingAddress} : {}),
    ...(email ? {email} : {}),
    ...(phone ? {phone} : {}),
    currency: 'INR',
    presentmentCurrency: 'INR',
    sourceIdentifier: order.id,
    tags: ['razorpay', 'magic-checkout', payment ? 'prepaid' : 'cod'],
    note: `Razorpay Magic Checkout order ${order.id}`,
    customAttributes: [
      {key: 'razorpay_order_id', value: order.id},
      ...(payment ? [{key: 'razorpay_payment_id', value: payment.id}] : []),
    ],
    taxesIncluded: order.tax_details?.taxes_included === true,
    test,
    ...(payment
      ? {
          transactions: [
            {
              amountSet: money(order.amount),
              authorizationCode: payment.id,
              gateway: 'Razorpay',
              kind: 'SALE',
              status: 'SUCCESS',
              test,
              receiptJson: {
                razorpay_order_id: order.id,
                razorpay_payment_id: payment.id,
                method: payment.method,
              },
            },
          ],
        }
      : {financialStatus: 'PENDING'}),
  };
}

const SHOPIFY_REQUEST_TIMEOUT_MS = 10_000;
const SHOPIFY_TOKEN_EXPIRY_BUFFER_MS = 60_000;
const SHOPIFY_THROTTLE_MAX_WAIT_MS = 2_000;

type ShopifyAdminToken = {
  accessToken: string;
  expiresAt: number;
  scopes?: ReadonlySet<string>;
};

type ShopifyTokenCacheEntry = {
  token?: ShopifyAdminToken;
  inFlight?: Promise<ShopifyAdminToken>;
};

const shopifyTokenCaches = new WeakMap<
  typeof fetch,
  Map<string, ShopifyTokenCacheEntry>
>();

function tokenCache(fetcher: typeof fetch) {
  let cache = shopifyTokenCaches.get(fetcher);
  if (!cache) {
    cache = new Map();
    shopifyTokenCaches.set(fetcher, cache);
  }
  return cache;
}

function tokenCacheKey(credentials: ShopifyAdminCredentials) {
  return `${credentials.domain}\n${credentials.clientId}`;
}

function assertRequiredScopes(
  scopes: ReadonlySet<string> | undefined,
  requiredScopes: readonly string[],
) {
  if (!scopes) return;
  const missing = requiredScopes.filter((scope) => !scopes.has(scope));
  if (missing.length) {
    throw new RazorpayReconciliationError(
      'Shopify required access scope is missing',
      'SHOPIFY_REQUIRED_SCOPE_MISSING',
    );
  }
}

export async function fetchShopifyAdminWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = SHOPIFY_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, {...init, signal: controller.signal});
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RazorpayReconciliationError(
        'Shopify request timed out',
        'SHOPIFY_ORDER_WRITE_FAILED',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestShopifyAdminToken(
  credentials: ShopifyAdminCredentials,
  fetcher: typeof fetch,
  requiredScopes: readonly string[],
): Promise<ShopifyAdminToken> {
  const tokenResponse = await fetchShopifyAdminWithTimeout(
    fetcher,
    `https://${credentials.domain}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new RazorpayReconciliationError(
      'Shopify authentication failed',
      'SHOPIFY_AUTHENTICATION_FAILED',
    );
  }
  const value = (await tokenResponse.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
  };
  if (typeof value.access_token !== 'string' || !value.access_token) {
    throw new RazorpayReconciliationError(
      'Shopify authentication failed',
      'SHOPIFY_AUTHENTICATION_FAILED',
    );
  }
  const scopes =
    typeof value.scope === 'string'
      ? new Set(value.scope.split(/[\s,]+/).filter(Boolean))
      : undefined;
  assertRequiredScopes(scopes, requiredScopes);
  const expiresIn =
    typeof value.expires_in === 'number' && Number.isFinite(value.expires_in)
      ? Math.max(0, value.expires_in)
      : 0;
  return {
    accessToken: value.access_token,
    expiresAt: Date.now() + expiresIn * 1_000,
    scopes,
  };
}

async function getShopifyAdminToken(
  credentials: ShopifyAdminCredentials,
  fetcher: typeof fetch,
  requiredScopes: readonly string[],
  forceRefresh = false,
) {
  const cache = tokenCache(fetcher);
  const key = tokenCacheKey(credentials);
  if (forceRefresh) cache.delete(key);
  let entry = cache.get(key);
  if (!entry) {
    entry = {};
    cache.set(key, entry);
  }
  if (
    entry.token &&
    Date.now() < entry.token.expiresAt - SHOPIFY_TOKEN_EXPIRY_BUFFER_MS
  ) {
    assertRequiredScopes(entry.token.scopes, requiredScopes);
    return entry.token.accessToken;
  }
  if (!entry.inFlight) {
    entry.inFlight = requestShopifyAdminToken(credentials, fetcher, requiredScopes)
      .then((token) => {
        entry!.token = token;
        return token;
      })
      .finally(() => {
        entry!.inFlight = undefined;
      });
  }
  const token = await entry.inFlight;
  assertRequiredScopes(token.scopes, requiredScopes);
  return token.accessToken;
}

type ShopifyGraphqlError = {
  extensions?: {code?: unknown};
};

type ShopifyGraphqlResult<T> = {
  data?: T;
  errors?: ShopifyGraphqlError[];
  extensions?: {
    cost?: {
      requestedQueryCost?: unknown;
      throttleStatus?: {
        currentlyAvailable?: unknown;
        restoreRate?: unknown;
      };
    };
  };
};

function shopifyThrottleDelay(result: ShopifyGraphqlResult<unknown>) {
  const cost = result.extensions?.cost;
  const requested = cost?.requestedQueryCost;
  const available = cost?.throttleStatus?.currentlyAvailable;
  const restoreRate = cost?.throttleStatus?.restoreRate;
  if (
    typeof requested !== 'number' ||
    typeof available !== 'number' ||
    typeof restoreRate !== 'number' ||
    restoreRate <= 0
  ) {
    return 250;
  }
  return Math.min(
    SHOPIFY_THROTTLE_MAX_WAIT_MS,
    Math.max(25, Math.ceil(((requested - available) / restoreRate) * 1_000)),
  );
}

async function adminGraphql<T>({
  credentials,
  query,
  variables,
  fetcher,
  requiredScopes,
}: {
  credentials: ShopifyAdminCredentials;
  query: string;
  variables: Record<string, unknown>;
  fetcher: typeof fetch;
  requiredScopes: readonly string[];
}): Promise<T> {
  let refreshedAuthentication = false;
  let refreshAuthentication = false;
  let retriedThrottle = false;
  for (;;) {
    const token = await getShopifyAdminToken(
      credentials,
      fetcher,
      requiredScopes,
      refreshAuthentication,
    );
    refreshAuthentication = false;
    const response = await fetchShopifyAdminWithTimeout(
      fetcher,
      `https://${credentials.domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({query, variables}),
      },
    );
    if (response.status === 401 && !refreshedAuthentication) {
      refreshedAuthentication = true;
      refreshAuthentication = true;
      continue;
    }
    if (response.status === 401) {
      throw new RazorpayReconciliationError(
        'Shopify authentication failed',
        'SHOPIFY_AUTHENTICATION_FAILED',
      );
    }
    if (!response.ok) {
      throw new RazorpayReconciliationError(
        'Shopify order API failed',
        'SHOPIFY_ORDER_WRITE_FAILED',
      );
    }
    const result = (await response.json()) as ShopifyGraphqlResult<T>;
    const throttled = result.errors?.some(
      (error) => error.extensions?.code === 'THROTTLED',
    );
    if (throttled && !retriedThrottle) {
      retriedThrottle = true;
      await new Promise((resolve) =>
        setTimeout(resolve, shopifyThrottleDelay(result),
      ));
      continue;
    }
    if (throttled) {
      throw new RazorpayReconciliationError(
        'Shopify Admin GraphQL request was throttled',
        'SHOPIFY_GRAPHQL_THROTTLED',
      );
    }
    if (result.errors?.length || !result.data) {
      console.error('Shopify Admin GraphQL request failed', {
        errorCount: result.errors?.length ?? 0,
      });
      throw new RazorpayReconciliationError(
        'Shopify order API returned errors',
        'SHOPIFY_ORDER_WRITE_FAILED',
      );
    }
    return result.data;
  }
}

export async function createRazorpayDraftOrderAnchor({
  env,
  lines,
  source,
  fetcher = fetch,
}: {
  env: Env;
  lines: RazorpayOrderLine[];
  source: 'cart' | 'product';
  fetcher?: typeof fetch;
}) {
  const credentials = adminCredentials(env);
  if (!credentials) {
    throw new RazorpayReconciliationError('Shopify draft order API is not configured');
  }
  if (!lines.length || lines.length > 499) {
    throw new RazorpayReconciliationError('Shopify draft order lines are invalid');
  }

  const lineItems = lines.map((line) => {
    if (
      !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.variantId) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.currencyCode !== 'INR'
    ) {
      throw new RazorpayReconciliationError('Shopify draft order line is invalid');
    }
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      priceOverride: {
        amount: (inrToPaise(line.unitPrice) / 100).toFixed(2),
        currencyCode: 'INR',
      },
    };
  });

  const result = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: {id: string; name: string; status: string} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation CreateRazorpayDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id name status }
        userErrors { field message }
      }
    }`,
    variables: {
      input: {
        lineItems,
        presentmentCurrencyCode: 'INR',
        visibleToCustomer: false,
        allowDiscountCodesInCheckout: false,
        tags: ['razorpay', 'magic-checkout', 'checkout-draft'],
        note: 'Pending Razorpay Magic Checkout payment',
        customAttributes: [
          {key: 'checkout_provider', value: 'razorpay'},
          {key: 'checkout_source', value: source},
        ],
      },
    },
  });

  const draftOrder = result.draftOrderCreate.draftOrder;
  if (
    result.draftOrderCreate.userErrors.length ||
    !draftOrder ||
    !/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draftOrder.id)
  ) {
    console.error(
      'Shopify rejected Razorpay draft order creation',
      result.draftOrderCreate.userErrors,
    );
    throw new RazorpayReconciliationError('Shopify rejected the Razorpay draft order');
  }
  return draftOrder;
}

export async function deleteRazorpayDraftOrderAnchor({
  env,
  draftOrderId,
  fetcher = fetch,
}: {
  env: Env;
  draftOrderId: string;
  fetcher?: typeof fetch;
}) {
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draftOrderId)) return false;
  const credentials = adminCredentials(env);
  if (!credentials) return false;

  const result = await adminGraphql<{
    draftOrderDelete: {
      deletedId: string | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation DeleteRazorpayDraftOrder($input: DraftOrderDeleteInput!) {
      draftOrderDelete(input: $input) {
        deletedId
        userErrors { field message }
      }
    }`,
    variables: {input: {id: draftOrderId}},
  });

  return (
    result.draftOrderDelete.userErrors.length === 0 &&
    result.draftOrderDelete.deletedId === draftOrderId
  );
}

type ShopifyOrderReference = {id: string; name: string};

type RazorpayDraftOrderState = {
  id: string;
  status: string;
  order: ShopifyOrderReference | null;
  totalPriceSet?: {
    presentmentMoney: {amount: string; currencyCode: string};
  };
};

function validShopifyOrderReference(
  value: ShopifyOrderReference | null | undefined,
): value is ShopifyOrderReference {
  return Boolean(
    value &&
    /^gid:\/\/shopify\/Order\/\d+$/.test(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim(),
  );
}

function razorpayDraftOrderId(order: RazorpayMagicOrderDetails) {
  const value = order.notes.shopify_draft_order_id;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(value)) {
    throw new RazorpayReconciliationError('Invalid Shopify draft order anchor');
  }
  return value;
}

export function buildRazorpayDraftOrderFinalInput({
  order,
  payment,
}: {
  order: RazorpayMagicOrderDetails;
  payment: RazorpayPaymentDetails;
}) {
  const shippingAddress = mailingAddress(order.customer_details?.shipping_address);
  if (!shippingAddress) {
    throw new RazorpayReconciliationError('Razorpay shipping address is missing');
  }
  const billingAddress = mailingAddress(order.customer_details?.billing_address);
  const email = stringValue(order.customer_details?.email, 254);
  const phone = stringValue(order.customer_details?.contact, 30);
  const source = stringValue(order.notes.source, 20);
  const shippingFee = integer(order.shipping_fee ?? 0, 'shipping fee');
  const codFee = integer(order.cod_fee ?? 0, 'COD fee');

  return {
    shippingAddress,
    ...(billingAddress ? {billingAddress} : {}),
    ...(email ? {email} : {}),
    ...(phone ? {phone} : {}),
    ...(shippingFee + codFee > 0
      ? {
          shippingLine: {
            title: codFee ? 'Standard delivery and COD fee' : 'Standard delivery',
            priceWithCurrency: {
              amount: paiseToRupees(shippingFee + codFee),
              currencyCode: 'INR',
            },
          },
        }
      : {}),
    tags: ['razorpay', 'magic-checkout', 'prepaid'],
    note: `Razorpay Magic Checkout order ${order.id}`,
    customAttributes: [
      {key: 'checkout_provider', value: 'razorpay'},
      ...(source ? [{key: 'checkout_source', value: source}] : []),
      {key: 'razorpay_order_id', value: order.id},
      {key: 'razorpay_payment_id', value: payment.id},
      ...(payment.method
        ? [{key: 'razorpay_payment_method', value: payment.method.slice(0, 100)}]
        : []),
    ],
    visibleToCustomer: false,
  };
}

async function getRazorpayDraftOrder({
  credentials,
  draftOrderId,
  fetcher,
}: {
  credentials: ShopifyAdminCredentials;
  draftOrderId: string;
  fetcher: typeof fetch;
}) {
  const result = await adminGraphql<{draftOrder: RazorpayDraftOrderState | null}>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `query RazorpayDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        status
        totalPriceSet { presentmentMoney { amount currencyCode } }
        order { id name }
      }
    }`,
    variables: {id: draftOrderId},
  });
  return result.draftOrder;
}

export async function completeRazorpayDraftOrder({
  env,
  draftOrderId,
  order,
  payment,
  fetcher = fetch,
}: {
  env: Env;
  draftOrderId: string;
  order: RazorpayMagicOrderDetails;
  payment: RazorpayPaymentDetails;
  fetcher?: typeof fetch;
}) {
  if (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draftOrderId)) {
    throw new RazorpayReconciliationError('Invalid Shopify draft order anchor');
  }
  const credentials = adminCredentials(env);
  if (!credentials) {
    throw new RazorpayReconciliationError('Shopify draft order API is not configured');
  }

  const current = await getRazorpayDraftOrder({credentials, draftOrderId, fetcher});
  if (!current || current.id !== draftOrderId) {
    throw new RazorpayReconciliationError('Shopify draft order anchor was not found');
  }
  if (validShopifyOrderReference(current.order)) {
    return {...current.order, created: false};
  }
  if (current.status !== 'OPEN') {
    throw new RazorpayReconciliationError('Shopify draft order is not open');
  }

  const updated = await adminGraphql<{
    draftOrderUpdate: {
      draftOrder: RazorpayDraftOrderState | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_draft_orders'],
    query: `mutation UpdateRazorpayDraftOrder($id: ID!, $input: DraftOrderInput!) {
      draftOrderUpdate(id: $id, input: $input) {
        draftOrder {
          id
          status
          totalPriceSet { presentmentMoney { amount currencyCode } }
          order { id name }
        }
        userErrors { field message }
      }
    }`,
    variables: {
      id: draftOrderId,
      input: buildRazorpayDraftOrderFinalInput({order, payment}),
    },
  });
  const updatedDraft = updated.draftOrderUpdate.draftOrder;
  const total = updatedDraft?.totalPriceSet?.presentmentMoney;
  if (
    updated.draftOrderUpdate.userErrors.length ||
    !updatedDraft ||
    updatedDraft.id !== draftOrderId ||
    updatedDraft.status !== 'OPEN' ||
    !total ||
    total.currencyCode !== 'INR' ||
    inrToPaise(total.amount) !== order.amount
  ) {
    console.error(
      'Shopify rejected Razorpay draft order finalization',
      updated.draftOrderUpdate.userErrors,
    );
    throw new RazorpayReconciliationError('Shopify rejected the Razorpay draft order');
  }

  let completed:
    | {
        draftOrderComplete: {
          draftOrder: RazorpayDraftOrderState | null;
          userErrors: Array<{field?: string[]; message: string}>;
        };
      }
    | undefined;
  let completionError: unknown;
  try {
    completed = await adminGraphql({
      credentials,
      fetcher,
      requiredScopes: ['write_draft_orders'],
      query: `mutation CompleteRazorpayDraftOrder($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder { id status order { id name } }
          userErrors { field message }
        }
      }`,
      variables: {id: draftOrderId},
    });
  } catch (error) {
    completionError = error;
  }
  const completedOrder = completed?.draftOrderComplete.draftOrder?.order;
  if (
    completed?.draftOrderComplete.userErrors.length === 0 &&
    validShopifyOrderReference(completedOrder)
  ) {
    return {...completedOrder, created: true};
  }

  // A concurrent retry can lose the completion race but must return the one
  // order already attached to this durable Shopify draft instead of failing.
  const reconciled = await getRazorpayDraftOrder({credentials, draftOrderId, fetcher});
  if (validShopifyOrderReference(reconciled?.order)) {
    return {...reconciled.order, created: false};
  }
  if (completionError) throw completionError;
  console.error(
    'Shopify rejected Razorpay draft order completion',
    completed?.draftOrderComplete.userErrors ?? [],
  );
  throw new RazorpayReconciliationError('Shopify rejected the Razorpay draft order');
}

export async function createShopifyOrder(
  env: Env,
  order: RazorpayMagicOrderDetails,
  lines: RazorpayCheckoutSnapshotLine[],
  payment: RazorpayPaymentDetails | null,
  fetcher: typeof fetch,
) {
  const credentials = adminCredentials(env);
  if (!credentials)
    throw new RazorpayReconciliationError('Shopify order API is not configured');
  const query = `source_identifier:${order.id}`;
  const existing = await adminGraphql<{
    orders: {nodes: Array<{id: string; name: string}>};
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_orders'],
    query: `query RazorpayExistingOrder($query: String!) {
      orders(first: 1, query: $query) { nodes { id name } }
    }`,
    variables: {query},
  });
  if (existing.orders.nodes[0]) {
    return {...existing.orders.nodes[0], created: false};
  }

  const result = await adminGraphql<{
    orderCreate: {
      order: {id: string; name: string} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
    requiredScopes: ['write_orders'],
    query: `mutation CreateRazorpayOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order { id name }
        userErrors { field message }
      }
    }`,
    variables: {
      order: buildShopifyOrderInput({
        order,
        lines,
        payment,
        test: razorpayCredentials(env)?.keyId.startsWith('rzp_test_') === true,
      }),
      options: {
        inventoryBehaviour: 'DECREMENT_IGNORING_POLICY',
        sendReceipt: true,
        sendFulfillmentReceipt: false,
      },
    },
  });
  if (result.orderCreate.userErrors.length || !result.orderCreate.order) {
    console.error(
      'Shopify rejected Razorpay order creation',
      result.orderCreate.userErrors,
    );
    throw new RazorpayReconciliationError('Shopify rejected the Razorpay order');
  }
  return {...result.orderCreate.order, created: true};
}

async function fetchCapturedPayment(
  razorpay: RazorpayOxygen,
  order: RazorpayMagicOrderDetails,
  paymentId?: string,
) {
  if (paymentId) {
    return validateCapturedRazorpayPayment(
      await razorpay.payments.fetch(paymentId),
      order,
    );
  }
  const payments = await razorpay.orders.fetchPayments(order.id);
  const captured = payments.items.find(
    (payment) => payment.status === 'captured' && payment.order_id === order.id,
  );
  return validateCapturedRazorpayPayment(captured, order);
}

/**
 * Read-only validation used by webhook shadow mode. It deliberately performs
 * Razorpay API reads only: no Shopify authentication, query, or mutation.
 */
export async function inspectRazorpayPrepaidOrder({
  env,
  orderId,
  paymentId,
  fetcher = fetch,
}: {
  env: Env;
  orderId: string;
  paymentId: string;
  fetcher?: typeof fetch;
}) {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new RazorpayReconciliationError('Invalid Razorpay webhook target');
  }
  const credentials = razorpayCredentials(env);
  if (!credentials) throw new RazorpayReconciliationError('Razorpay is not configured');
  const razorpay = new RazorpayOxygen({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
  const {order} = validateRazorpayOrderForShopify(
    await razorpay.orders.fetch(orderId),
    orderId,
  );
  const payment = await fetchCapturedPayment(razorpay, order, paymentId);
  const draftOrderId = razorpayDraftOrderId(order);
  if (!draftOrderId) {
    throw new RazorpayReconciliationError('Shopify draft order anchor is missing');
  }
  return {orderId: order.id, paymentId: payment.id, draftOrderId};
}

async function reconcileRazorpayOrderOnce({
  env,
  orderId,
  paymentId,
  draftOrderId,
  requireDraftOrderAnchor = false,
  fetcher = fetch,
}: {
  env: Env;
  orderId: string;
  paymentId?: string;
  draftOrderId?: string;
  requireDraftOrderAnchor?: boolean;
  fetcher?: typeof fetch;
}) {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    throw new RazorpayReconciliationError('Invalid Razorpay order ID');
  }
  const credentials = razorpayCredentials(env);
  if (!credentials) throw new RazorpayReconciliationError('Razorpay is not configured');
  const razorpay = new RazorpayOxygen({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
  const {order, lines} = validateRazorpayOrderForShopify(
    await razorpay.orders.fetch(orderId),
    orderId,
  );
  let payment: RazorpayPaymentDetails | null;
  if (order.status === 'paid') {
    payment = await fetchCapturedPayment(razorpay, order, paymentId);
  } else if (
    order.status === 'placed' &&
    integer(order.amount_paid, 'paid amount') === 0 &&
    integer(order.amount_due, 'amount due') === order.amount
  ) {
    payment = null;
  } else {
    throw new RazorpayReconciliationError('Razorpay order is not payable');
  }
  const anchoredDraftOrderId = razorpayDraftOrderId(order);
  if (
    requireDraftOrderAnchor &&
    (!payment || !razorpayDraftOrderAnchorEnabled(env) || !anchoredDraftOrderId)
  ) {
    throw new RazorpayReconciliationError(
      'Razorpay checkout draft order anchor is required for webhook recovery',
    );
  }
  if (
    draftOrderId !== undefined &&
    (!/^gid:\/\/shopify\/DraftOrder\/\d+$/.test(draftOrderId) ||
      draftOrderId !== anchoredDraftOrderId)
  ) {
    throw new RazorpayReconciliationError('Shopify draft order anchor mismatch');
  }
  const shopifyOrder =
    payment && razorpayDraftOrderAnchorEnabled(env) && anchoredDraftOrderId
      ? await completeRazorpayDraftOrder({
          env,
          draftOrderId: anchoredDraftOrderId,
          order,
          payment,
          fetcher,
        })
      : await createShopifyOrder(env, order, lines, payment, fetcher);
  return {shopifyOrder, razorpayOrder: order, payment};
}

const reconciliationInFlight = new Map<
  string,
  ReturnType<typeof reconcileRazorpayOrderOnce>
>();

export function reconcileRazorpayOrder(
  input: Parameters<typeof reconcileRazorpayOrderOnce>[0],
) {
  const existing = reconciliationInFlight.get(input.orderId);
  if (existing) return existing;

  const reconciliation = reconcileRazorpayOrderOnce(input).finally(() => {
    reconciliationInFlight.delete(input.orderId);
  });
  reconciliationInFlight.set(input.orderId, reconciliation);
  return reconciliation;
}

export function razorpayOrderIntegrationReady(env: Env) {
  return Boolean(
    razorpayCredentials(env) &&
    adminCredentials(env) &&
    env.RAZORPAY_WEBHOOK_SECRET?.trim(),
  );
}
