export const RECENT_PRODUCTS_UPDATED_EVENT = 'charaideo:recent-products-updated';

const RECENT_PRODUCTS_STORAGE_KEY = 'charaideo:recent-products:v1';
const RECENT_PRODUCTS_LIMIT = 4;

export type RecentProduct = {
  handle: string;
  title: string;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  image: {
    url: string;
    altText: string;
  } | null;
  viewedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function readRecentProducts(storage: StorageLike): RecentProduct[] {
  try {
    const stored = storage.getItem(RECENT_PRODUCTS_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isRecentProduct).slice(0, RECENT_PRODUCTS_LIMIT);
  } catch {
    return [];
  }
}

export function rememberRecentProduct(
  storage: StorageLike,
  product: RecentProduct,
) {
  if (!isRecentProduct(product)) return [];

  const recentProducts = [
    product,
    ...readRecentProducts(storage).filter(
      (item) => item.variantId !== product.variantId,
    ),
  ].slice(0, RECENT_PRODUCTS_LIMIT);

  try {
    storage.setItem(RECENT_PRODUCTS_STORAGE_KEY, JSON.stringify(recentProducts));
  } catch {
    // Browsing still works when storage is blocked or full.
  }

  return recentProducts;
}

function isRecentProduct(value: unknown): value is RecentProduct {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<RecentProduct>;

  return Boolean(
    isNonEmptyString(product.handle) &&
      isNonEmptyString(product.title) &&
      isNonEmptyString(product.variantId) &&
      typeof product.variantTitle === 'string' &&
      product.price &&
      isNonEmptyString(product.price.amount) &&
      isNonEmptyString(product.price.currencyCode) &&
      Number.isFinite(Number(product.price.amount)) &&
      (product.image === null ||
        (product.image &&
          isHttpUrl(product.image.url) &&
          typeof product.image.altText === 'string')) &&
      typeof product.viewedAt === 'number' &&
      Number.isFinite(product.viewedAt),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: unknown) {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
