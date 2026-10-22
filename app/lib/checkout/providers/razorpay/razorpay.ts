export type RazorpayCheckoutProduct = {variantId: string; quantity: number};

export type RazorpayOrderLine = {
  variantId: string;
  productId: string;
  sku?: string | null;
  quantity: number;
  unitPrice: string;
  compareAtPrice?: string | null;
  currencyCode: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  productUrl?: string | null;
};

export type RazorpayMagicLineItem = {
  sku: string;
  variant_id: string;
  price: number;
  offer_price: number;
  quantity: number;
  name: string;
  description: string;
  image_url?: string;
  product_url?: string;
};

export type RazorpayCheckoutSnapshotLine = {
  variantId: string;
  quantity: number;
  unitPricePaise: number;
};

const RAZORPAY_SUPPORTED_CURRENCIES = new Set(
  `AED ALL AMD AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN
   BWP BZD CAD CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ETB EUR
   FJD GBP GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD ISK
   JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LKR LRD LSL MAD MDL MGA
   MKD MMK MNT MOP MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PEN
   PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SCR SEK SGD SLL SOS SVC SZL
   THB TND TRY TTD TWD TZS UAH UGX USD UYU UZS VND VUV XAF XCD XOF XPF YER
   ZAR ZMW`
    .split(/\s+/)
    .filter(Boolean),
);

const RAZORPAY_ZERO_DECIMAL_CURRENCIES = new Set(
  'BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF'.split(' '),
);

const RAZORPAY_THREE_DECIMAL_CURRENCIES = new Set(
  'BHD IQD JOD KWD OMR TND'.split(' '),
);

export function razorpayCurrencyCode(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!RAZORPAY_SUPPORTED_CURRENCIES.has(currency)) {
    throw new Error('Unsupported Razorpay currency code');
  }
  return currency;
}

export function currencyFractionDigits(currencyCode: string): number {
  const currency = razorpayCurrencyCode(currencyCode);
  if (RAZORPAY_ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (RAZORPAY_THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

export function amountToSubunits(amount: string, currencyCode: string): number {
  const currency = razorpayCurrencyCode(currencyCode);
  const digits = currencyFractionDigits(currency);
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${Math.max(digits, 1)}}))?$`).exec(
    amount,
  );
  if (!match || (digits === 0 && match[2])) throw new Error(`Invalid ${currency} amount`);
  const fraction = digits ? (match[2] ?? '').padEnd(digits, '0') : '';
  let subunits = Number(match[1]) * 10 ** digits + Number(fraction || 0);
  if (!Number.isSafeInteger(subunits) || subunits < 0) {
    throw new Error(`Invalid ${currency} amount`);
  }
  return subunits;
}

export function subunitsToAmount(value: number, currencyCode: string): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid currency amount');
  const digits = currencyFractionDigits(currencyCode);
  return (value / 10 ** digits).toFixed(digits);
}

const RAZORPAY_RECONCILIATION_EVENTS = new Set(['order.placed']);

export function isRazorpayPrepaidShadowEvent(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as {event?: unknown}).event === 'order.paid'
  );
}

export function razorpayPaidWebhookTarget(value: unknown): {
  orderId: string;
  paymentId: string;
} | null {
  if (!isRazorpayPrepaidShadowEvent(value)) return null;
  const payload = (
    value as {
      payload?: {
        order?: {entity?: {id?: unknown}};
        payment?: {entity?: {id?: unknown; order_id?: unknown}};
      };
    }
  ).payload;
  const orderId = payload?.order?.entity?.id;
  const paymentId = payload?.payment?.entity?.id;
  const paymentOrderId = payload?.payment?.entity?.order_id;
  return typeof orderId === 'string' &&
    /^order_[A-Za-z0-9]+$/.test(orderId) &&
    typeof paymentId === 'string' &&
    /^pay_[A-Za-z0-9]+$/.test(paymentId) &&
    paymentOrderId === orderId
    ? {orderId, paymentId}
    : null;
}

export function isRazorpayReconciliationEvent(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    RAZORPAY_RECONCILIATION_EVENTS.has(
      String((value as {event?: unknown}).event ?? ''),
    )
  );
}

export function razorpayWebhookTarget(value: unknown): {
  orderId: string;
  paymentId?: string;
} | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as {
    event?: unknown;
    payload?: {
      order?: {entity?: {id?: unknown}};
      payment?: {entity?: {id?: unknown; order_id?: unknown}};
    };
  };
  if (event.event === 'order.placed') {
    const orderId = event.payload?.order?.entity?.id;
    return typeof orderId === 'string' && /^order_[A-Za-z0-9]+$/.test(orderId)
      ? {orderId}
      : null;
  }
  return null;
}

export function razorpayVariantId(gid: string): string | null {
  const match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(gid);
  return match?.[1] ?? null;
}

export function razorpayProductId(gid: string): string | null {
  const match = /^gid:\/\/shopify\/Product\/(\d+)$/.exec(gid);
  return match?.[1] ?? null;
}

export function canStartRazorpayCheckout(products: RazorpayCheckoutProduct[]): boolean {
  return (
    products.length > 0 &&
    products.length <= 25 &&
    products.every(
      ({variantId, quantity}) =>
        Boolean(razorpayVariantId(variantId)) &&
        Number.isSafeInteger(quantity) &&
        quantity > 0 &&
        quantity <= 100,
    )
  );
}

export function parseRazorpayCheckoutProducts(
  value: FormDataEntryValue | null,
): RazorpayCheckoutProduct[] | null {
  if (typeof value !== 'string' || value.length > 8_192) return null;

  try {
    const products = JSON.parse(value) as unknown;
    if (!Array.isArray(products)) return null;
    const normalized = products.map((product) => {
      if (!product || typeof product !== 'object') return null;
      const {variantId, quantity} = product as Record<string, unknown>;
      if (typeof variantId !== 'string' || typeof quantity !== 'number') return null;
      return {variantId, quantity};
    });
    if (normalized.some((product) => product === null)) return null;
    const validProducts = normalized as RazorpayCheckoutProduct[];
    return canStartRazorpayCheckout(validProducts) ? validProducts : null;
  } catch {
    return null;
  }
}

export function inrToPaise(amount: string): number {
  return amountToSubunits(amount, 'INR');
}

export function buildRazorpayMagicOrder(lines: RazorpayOrderLine[]) {
  if (!lines.length) throw new Error('Checkout has no products');

  const currency = razorpayCurrencyCode(lines[0].currencyCode);
  let amount = 0;
  const lineItems: RazorpayMagicLineItem[] = lines.map((line) => {
    if (razorpayCurrencyCode(line.currencyCode) !== currency) {
      throw new Error('Checkout currencies do not match');
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Invalid product quantity');
    }

    const variantId = razorpayVariantId(line.variantId);
    const productId = razorpayProductId(line.productId);
    if (!variantId || !productId) throw new Error('Invalid Shopify product ID');

    const offerPrice = amountToSubunits(line.unitPrice, currency);
    const price = Math.max(
      offerPrice,
      line.compareAtPrice ? amountToSubunits(line.compareAtPrice, currency) : offerPrice,
    );
    amount += offerPrice * line.quantity;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Invalid checkout total');
    }

    return {
      sku: line.sku?.trim() || productId,
      variant_id: variantId,
      price,
      offer_price: offerPrice,
      quantity: line.quantity,
      name: line.name.slice(0, 255),
      description: line.description.slice(0, 255),
      ...(line.imageUrl ? {image_url: line.imageUrl} : {}),
      ...(line.productUrl ? {product_url: line.productUrl} : {}),
    };
  });

  return {amount, currency, lineItems};
}

export function encodeRazorpayCheckoutSnapshot(
  lines: RazorpayOrderLine[],
): Record<string, string> {
  const records = lines.map((line) => {
    const variantId = razorpayVariantId(line.variantId);
    if (!variantId) throw new Error('Invalid Shopify variant ID');
    return `${variantId}:${line.quantity}:${amountToSubunits(line.unitPrice, line.currencyCode)}`;
  });
  const chunks: string[] = [];
  for (const record of records) {
    const last = chunks.at(-1);
    if (last && `${last},${record}`.length <= 240) {
      chunks[chunks.length - 1] = `${last},${record}`;
    } else {
      chunks.push(record);
    }
  }
  if (chunks.length > 10) throw new Error('Checkout snapshot is too large');
  return Object.fromEntries(chunks.map((value, index) => [`items_${index}`, value]));
}

export function decodeRazorpayCheckoutSnapshot(
  notes: Record<string, unknown>,
): RazorpayCheckoutSnapshotLine[] | null {
  const chunks = Object.entries(notes)
    .filter(([key]) => /^items_\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(6)) - Number(right.slice(6)))
    .map(([, value]) => value);
  if (!chunks.length || chunks.some((value) => typeof value !== 'string')) return null;

  const lines = (chunks as string[]).flatMap((chunk) => chunk.split(',')).map((record) => {
    const match = /^(\d+):(\d+):(\d+)$/.exec(record);
    if (!match) return null;
    const quantity = Number(match[2]);
    const unitPricePaise = Number(match[3]);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100 ||
      !Number.isSafeInteger(unitPricePaise) ||
      unitPricePaise < 0
    ) {
      return null;
    }
    return {
      variantId: `gid://shopify/ProductVariant/${match[1]}`,
      quantity,
      unitPricePaise,
    };
  });
  return lines.length > 25 || lines.some((line) => line === null)
    ? null
    : (lines as RazorpayCheckoutSnapshotLine[]);
}
