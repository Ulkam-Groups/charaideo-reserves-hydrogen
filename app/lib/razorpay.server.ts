/** Server-only clients and checks for the custom ecommerce Magic Checkout flow. */
const ADMIN_VERSION = '2026-07';

export type MagicOrder = {
  id: string;
  receipt: string;
  amount: number;
  currency: string;
  status: string;
  line_items_total?: number;
  shipping_fee?: number;
  cod_fee?: number;
  promotions?: Array<{value?: number}>;
  customer_details?: {
    email?: string;
    contact?: string;
    shipping_address?: MagicAddress;
    billing_address?: MagicAddress;
  };
};

export type MagicPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  captured?: boolean;
};

type MagicAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  contact?: string;
};

type GraphQLResult<T> = {data?: T; errors?: Array<{message: string}>};

export function razorpayConfigured(env: Env) {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.SHOPIFY_ADMIN_API_TOKEN && env.RAZORPAY_CUSTOM_SHIPPING_READY === 'true');
}

export async function razorpayApi<T>(env: Env, path: string, body?: unknown): Promise<T> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay is not configured');
  if (!/^\/(orders|payments)(\/[-\w]+)?$/.test(path)) throw new Error('Invalid Razorpay path');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  if (!response.ok) throw new Error(`Razorpay API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function shopifyAdmin<T>(env: Env, query: string, variables: Record<string, unknown>): Promise<T> {
  const shop = env.PUBLIC_STORE_DOMAIN;
  const token = env.SHOPIFY_ADMIN_API_TOKEN;
  if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop) || !token) {
    throw new Error('Shopify Admin API is not configured');
  }
  const response = await fetch(`https://${shop}/admin/api/${ADMIN_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': token},
    body: JSON.stringify({query, variables}),
  });
  if (!response.ok) throw new Error(`Shopify Admin API returned ${response.status}`);
  const result = (await response.json()) as GraphQLResult<T>;
  if (result.errors?.length || !result.data) {
    throw new Error(`Shopify Admin GraphQL failed: ${result.errors?.map((error) => error.message).join('; ')}`);
  }
  return result.data;
}

export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!/^order_[\w-]+$/.test(orderId) || !/^pay_[\w-]+$/.test(paymentId) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/.{2}/g)!, (hex) => Number.parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${orderId}|${paymentId}`));
}

export function draftIdFromReceipt(receipt: string) {
  const match = /^draft_(\d+)$/.exec(receipt);
  return match ? `gid://shopify/DraftOrder/${match[1]}` : null;
}

export function receiptFromDraftId(id: string) {
  const match = /^gid:\/\/shopify\/DraftOrder\/(\d+)$/.exec(id);
  if (!match) throw new Error('Invalid draft order ID');
  return `draft_${match[1]}`;
}

export function paymentKind(order: MagicOrder, payment: MagicPayment): 'prepaid' | 'cod' | null {
  if (payment.order_id !== order.id || payment.currency !== 'INR' || order.currency !== 'INR' || payment.amount !== order.amount) return null;
  if (order.status === 'paid' && payment.status === 'captured' && payment.captured && payment.method !== 'cod') return 'prepaid';
  if (order.status === 'placed' && payment.status === 'pending' && payment.method === 'cod' && !payment.captured) return 'cod';
  return null;
}

export function toShopifyAddress(address?: MagicAddress) {
  if (!address) return null;
  const name = (address.name || '').trim().split(/\s+/);
  return {
    firstName: name.shift() || '',
    lastName: name.join(' '),
    address1: address.line1 || '',
    address2: address.line2 || '',
    city: address.city || '',
    province: address.state || '',
    zip: address.zipcode || '',
    countryCode: address.country?.toUpperCase() || 'IN',
    phone: address.contact || '',
  };
}

type DraftRecord = {
  id: string;
  order: ShopifyOrder | null;
  totalPriceSet: {shopMoney: {amount: string; currencyCode: string}};
  lineItems: {nodes: Array<{
    quantity: number;
    name: string;
    sku: string | null;
    variant: {id: string; image: {url: string} | null} | null;
    originalUnitPriceSet: {shopMoney: {amount: string}};
  }>};
};

type ShopifyOrder = {id: string; name: string; displayFinancialStatus: string; totalPriceSet: {shopMoney: {amount: string; currencyCode: string}}};

const ORDER_FIELDS = 'id name displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } }';
const DRAFT_FIELDS = `id order { ${ORDER_FIELDS} } totalPriceSet { shopMoney { amount currencyCode } } lineItems(first: 100) { nodes { quantity name sku variant { id image { url } } originalUnitPriceSet { shopMoney { amount } } } }`;

function mutationResult<T>(result: {userErrors: Array<{message: string}>; draftOrder: T | null}): T {
  if (result.userErrors.length || !result.draftOrder) {
    throw new Error(`Shopify draft order failed: ${result.userErrors.map((error) => error.message).join('; ')}`);
  }
  return result.draftOrder;
}

export async function createDraft(env: Env, input: {lineItems: Array<{variantId: string; quantity: number}>; note?: string}) {
  const response = await shopifyAdmin<{draftOrderCreate: {draftOrder: DraftRecord | null; userErrors: Array<{message: string}>}}>(
    env,
    `mutation CreateMagicDraft($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { ${DRAFT_FIELDS} } userErrors { message } } }`,
    {input: {lineItems: input.lineItems, note: input.note, tags: ['razorpay-magic'], presentmentCurrencyCode: 'INR'}},
  );
  return mutationResult(response.draftOrderCreate);
}

export async function getDraft(env: Env, id: string) {
  const response = await shopifyAdmin<{draftOrder: DraftRecord | null}>(
    env,
    `query GetMagicDraft($id: ID!) { draftOrder(id: $id) { ${DRAFT_FIELDS} } }`,
    {id},
  );
  if (!response.draftOrder) throw new Error('Shopify draft order not found');
  return response.draftOrder;
}

export async function updateDraft(env: Env, id: string, input: Record<string, unknown>) {
  const response = await shopifyAdmin<{draftOrderUpdate: {draftOrder: DraftRecord | null; userErrors: Array<{message: string}>}}>(
    env,
    `mutation UpdateMagicDraft($id: ID!, $input: DraftOrderInput!) { draftOrderUpdate(id: $id, input: $input) { draftOrder { ${DRAFT_FIELDS} } userErrors { message } } }`,
    {id, input},
  );
  return mutationResult(response.draftOrderUpdate);
}

export async function completeDraft(env: Env, id: string, cod: boolean) {
  const response = await shopifyAdmin<{draftOrderComplete: {draftOrder: {order: ShopifyOrder | null} | null; userErrors: Array<{message: string}>}}>(
    env,
    `mutation CompleteMagicDraft($id: ID!, $pending: Boolean) { draftOrderComplete(id: $id, paymentPending: $pending) { draftOrder { order { ${ORDER_FIELDS} } } userErrors { message } } }`,
    {id, pending: cod},
  );
  const result = response.draftOrderComplete;
  if (result.userErrors.length || !result.draftOrder?.order) {
    throw new Error(`Shopify draft completion failed: ${result.userErrors.map((error) => error.message).join('; ')}`);
  }
  return result.draftOrder.order;
}

function confirmedShopifyOrder(order: ShopifyOrder, amount: number, kind: 'prepaid' | 'cod') {
  const expectedStatus = kind === 'cod' ? 'PENDING' : 'PAID';
  if (order.totalPriceSet.shopMoney.currencyCode !== 'INR' || paise(order.totalPriceSet.shopMoney.amount) !== amount || order.displayFinancialStatus !== expectedStatus) {
    throw new Error('Shopify order was created but its total or payment status needs reconciliation');
  }
  return {id: order.id, name: order.name};
}

export function paise(amount: string | number) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid currency amount');
  return Math.round(value * 100);
}

export function draftToMagicItems(draft: DraftRecord) {
  if (draft.totalPriceSet.shopMoney.currencyCode !== 'INR') throw new Error('Magic Checkout requires INR');
  if (!draft.lineItems.nodes.length || draft.lineItems.nodes.length > 100) throw new Error('Invalid draft order lines');
  return draft.lineItems.nodes.map((line) => {
    if (!line.variant || line.quantity < 1) throw new Error('Checkout requires Shopify variants');
    const numericId = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(line.variant.id)?.[1];
    if (!numericId) throw new Error('Invalid Shopify variant');
    const price = paise(line.originalUnitPriceSet.shopMoney.amount);
    return {
      sku: line.sku || numericId,
      variant_id: numericId,
      price,
      offer_price: price,
      quantity: line.quantity,
      name: line.name,
      description: line.name,
      ...(line.variant.image?.url ? {image_url: line.variant.image.url} : {}),
    };
  });
}

export async function synchronizeConfirmedOrder(env: Env, razorpayOrderId: string, razorpayPaymentId: string) {
  const [order, payment] = await Promise.all([
    razorpayApi<MagicOrder>(env, `/orders/${razorpayOrderId}`),
    razorpayApi<MagicPayment>(env, `/payments/${razorpayPaymentId}`),
  ]);
  const kind = paymentKind(order, payment);
  if (!kind) throw new Error('Razorpay payment is not confirmed');
  const draftId = draftIdFromReceipt(order.receipt);
  if (!draftId) throw new Error('Razorpay order is not linked to a Shopify draft');
  let draft = await getDraft(env, draftId);
  if (draft.order) return confirmedShopifyOrder(draft.order, order.amount, kind);
  if (order.promotions?.length) throw new Error('Razorpay promotion was not included in the Shopify draft');
  const baseAmount = paise(draft.totalPriceSet.shopMoney.amount);
  if (order.line_items_total !== baseAmount) throw new Error('Razorpay line item amount differs from Shopify draft');

  const shippingAddress = toShopifyAddress(order.customer_details?.shipping_address);
  if (!shippingAddress?.address1 || !shippingAddress.zip || shippingAddress.countryCode !== 'IN') {
    throw new Error('Confirmed Razorpay order has no valid Indian shipping address');
  }
  const billingAddress = toShopifyAddress(order.customer_details?.billing_address) || shippingAddress;
  const shippingFee = order.shipping_fee ?? 0;
  const codFee = order.cod_fee ?? 0;
  if (!Number.isSafeInteger(shippingFee) || shippingFee < 0 || !Number.isSafeInteger(codFee) || codFee < 0) {
    throw new Error('Invalid Razorpay shipping fees');
  }
  if ((kind === 'prepaid' && codFee !== 0) || order.amount !== baseAmount + shippingFee + codFee) {
    throw new Error('Razorpay total differs from its item and delivery breakdown');
  }
  const updatedLines: Array<Record<string, unknown>> = draft.lineItems.nodes.map((line) => ({variantId: line.variant!.id, quantity: line.quantity}));
  if (kind === 'cod' && codFee) {
    updatedLines.push({title: 'Cash on Delivery fee', quantity: 1, originalUnitPriceWithCurrency: {amount: (codFee / 100).toFixed(2), currencyCode: 'INR'}, requiresShipping: false, taxable: false});
  }
  draft = await updateDraft(env, draftId, {
    lineItems: updatedLines,
    shippingAddress,
    billingAddress,
    email: order.customer_details?.email || undefined,
    phone: order.customer_details?.contact || undefined,
    shippingLine: {title: 'Razorpay Magic Checkout', priceWithCurrency: {amount: (shippingFee / 100).toFixed(2), currencyCode: 'INR'}},
    note: `Razorpay order ${order.id}; payment ${payment.id}; ${kind}`,
    tags: ['razorpay-magic', kind],
  });
  if (draft.order) return confirmedShopifyOrder(draft.order, order.amount, kind);
  if (paise(draft.totalPriceSet.shopMoney.amount) !== order.amount) {
    throw new Error('Shopify and Razorpay totals differ; order needs reconciliation');
  }
  try {
    return confirmedShopifyOrder(await completeDraft(env, draftId, kind === 'cod'), order.amount, kind);
  } catch (error) {
    // Concurrent callback and webhook may have completed this draft already.
    const latest = await getDraft(env, draftId);
    if (latest.order) return confirmedShopifyOrder(latest.order, order.amount, kind);
    throw error;
  }
}
