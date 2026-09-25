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

const RAZORPAY_RECONCILIATION_EVENTS = new Set([
  'payment.captured',
  'order.paid',
  'order.placed',
]);

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
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    return typeof payment?.id === 'string' &&
      typeof payment.order_id === 'string' &&
      /^pay_[A-Za-z0-9]+$/.test(payment.id) &&
      /^order_[A-Za-z0-9]+$/.test(payment.order_id)
      ? {orderId: payment.order_id, paymentId: payment.id}
      : null;
  }
  if (event.event === 'order.paid' || event.event === 'order.placed') {
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
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error('Invalid INR amount');

  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new Error('Invalid INR amount');
  }
  return paise;
}

export function buildRazorpayMagicOrder(lines: RazorpayOrderLine[]) {
  if (!lines.length) throw new Error('Checkout has no products');

  let amount = 0;
  const lineItems: RazorpayMagicLineItem[] = lines.map((line) => {
    if (line.currencyCode !== 'INR') throw new Error('Razorpay requires INR');
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Invalid product quantity');
    }

    const variantId = razorpayVariantId(line.variantId);
    const productId = razorpayProductId(line.productId);
    if (!variantId || !productId) throw new Error('Invalid Shopify product ID');

    const offerPrice = inrToPaise(line.unitPrice);
    const price = Math.max(
      offerPrice,
      line.compareAtPrice ? inrToPaise(line.compareAtPrice) : offerPrice,
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

  return {amount, lineItems};
}

export function encodeRazorpayCheckoutSnapshot(
  lines: RazorpayOrderLine[],
): Record<string, string> {
  const records = lines.map((line) => {
    const variantId = razorpayVariantId(line.variantId);
    if (!variantId) throw new Error('Invalid Shopify variant ID');
    return `${variantId}:${line.quantity}:${inrToPaise(line.unitPrice)}`;
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
