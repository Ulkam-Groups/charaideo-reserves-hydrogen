import RazorpayOxygen from './razorpay-oxygen.server.ts';
import {
  decodeRazorpayCheckoutSnapshot,
  type RazorpayCheckoutSnapshotLine,
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

type ShopifyAdminToken = {
  domain: string;
  clientId: string;
  accessToken: string;
  expiresAt: number;
};

let cachedAdminToken: ShopifyAdminToken | null = null;
let adminTokenRequest: {
  domain: string;
  clientId: string;
  promise: Promise<string>;
} | null = null;

export class RazorpayReconciliationError extends Error {}

function invalidateAdminToken(credentials: ShopifyAdminCredentials) {
  if (
    cachedAdminToken?.domain === credentials.domain &&
    cachedAdminToken.clientId === credentials.clientId
  ) {
    cachedAdminToken = null;
  }
}

async function getAdminAccessToken(
  credentials: ShopifyAdminCredentials,
  fetcher: typeof fetch,
  forceRefresh = false,
) {
  if (
    !forceRefresh &&
    cachedAdminToken?.domain === credentials.domain &&
    cachedAdminToken.clientId === credentials.clientId &&
    Date.now() < cachedAdminToken.expiresAt - 60_000
  ) {
    return cachedAdminToken.accessToken;
  }
  if (
    !forceRefresh &&
    adminTokenRequest?.domain === credentials.domain &&
    adminTokenRequest.clientId === credentials.clientId
  ) {
    return adminTokenRequest.promise;
  }

  const request = (async () => {
    const response = await fetcher(
      `https://${credentials.domain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new RazorpayReconciliationError('Shopify authentication failed');
    }
    const token = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
      scope?: unknown;
    };
    if (typeof token.access_token !== 'string') {
      throw new RazorpayReconciliationError('Shopify authentication failed');
    }
    if (typeof token.scope === 'string') {
      const scopes = new Set(token.scope.split(',').map((scope) => scope.trim()));
      if (!scopes.has('read_orders') || !scopes.has('write_orders')) {
        throw new RazorpayReconciliationError(
          'Shopify app is missing required order scopes',
        );
      }
    }
    if (
      typeof token.expires_in === 'number' &&
      Number.isSafeInteger(token.expires_in) &&
      token.expires_in > 60
    ) {
      cachedAdminToken = {
        domain: credentials.domain,
        clientId: credentials.clientId,
        accessToken: token.access_token,
        expiresAt: Date.now() + token.expires_in * 1000,
      };
    }
    return token.access_token;
  })();
  adminTokenRequest = {
    domain: credentials.domain,
    clientId: credentials.clientId,
    promise: request,
  };
  try {
    return await request;
  } finally {
    if (adminTokenRequest?.promise === request) adminTokenRequest = null;
  }
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

async function adminGraphql<T>({
  credentials,
  query,
  variables,
  fetcher,
}: {
  credentials: ShopifyAdminCredentials;
  query: string;
  variables: Record<string, unknown>;
  fetcher: typeof fetch;
}): Promise<T> {
  const execute = async (forceRefresh = false) =>
    fetcher(`https://${credentials.domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': await getAdminAccessToken(
          credentials,
          fetcher,
          forceRefresh,
        ),
      },
      body: JSON.stringify({query, variables}),
      signal: AbortSignal.timeout(10_000),
    });
  let response = await execute();
  if (response.status === 401) {
    invalidateAdminToken(credentials);
    response = await execute(true);
  }
  if (!response.ok) throw new RazorpayReconciliationError('Shopify order API failed');
  const result = (await response.json()) as {data?: T; errors?: unknown[]};
  if (result.errors?.length || !result.data) {
    console.error('Shopify Admin GraphQL request failed', result.errors ?? []);
    throw new RazorpayReconciliationError('Shopify order API returned errors');
  }
  return result.data;
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
  const existing = await findShopifyOrder(env, order.id, fetcher);
  if (existing) {
    return {...existing, created: false};
  }

  const result = await adminGraphql<{
    orderCreate: {
      order: {id: string; name: string} | null;
      userErrors: Array<{field?: string[]; message: string}>;
    };
  }>({
    credentials,
    fetcher,
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

export async function findShopifyOrder(
  env: Env,
  orderId: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    throw new RazorpayReconciliationError('Invalid Razorpay order ID');
  }
  const credentials = adminCredentials(env);
  if (!credentials) {
    throw new RazorpayReconciliationError('Shopify order API is not configured');
  }
  const existing = await adminGraphql<{
    orders: {nodes: Array<{id: string; name: string}>};
  }>({
    credentials,
    fetcher,
    query: `query RazorpayExistingOrder($query: String!) {
      orders(first: 1, query: $query) { nodes { id name } }
    }`,
    variables: {query: `source_identifier:${orderId}`},
  });
  return existing.orders.nodes[0] ?? null;
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

async function fetchValidatedRazorpayOrder({
  env,
  orderId,
  paymentId,
}: {
  env: Env;
  orderId: string;
  paymentId?: string;
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
  return {razorpayOrder: order, lines, payment};
}

export function verifyRazorpayOrderPayment(input: {
  env: Env;
  orderId: string;
  paymentId: string;
}) {
  return fetchValidatedRazorpayOrder(input).then((result) => {
    if (!result.payment) {
      throw new RazorpayReconciliationError('Razorpay payment is not captured');
    }
    return result;
  });
}

async function reconcileRazorpayOrderOnce({
  env,
  orderId,
  paymentId,
  expectedStatus,
  fetcher = fetch,
}: {
  env: Env;
  orderId: string;
  paymentId?: string;
  expectedStatus?: 'paid' | 'placed';
  fetcher?: typeof fetch;
}) {
  const {
    razorpayOrder: order,
    lines,
    payment,
  } = await fetchValidatedRazorpayOrder({env, orderId, paymentId});
  if (expectedStatus && order.status !== expectedStatus) {
    return {shopifyOrder: null, razorpayOrder: order, payment};
  }
  const shopifyOrder = await createShopifyOrder(env, order, lines, payment, fetcher);
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
