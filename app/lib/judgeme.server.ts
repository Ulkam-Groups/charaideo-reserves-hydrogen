import type {Monitor} from './monitoring.server';

const JUDGEME_API_BASE = 'https://api.judge.me/api/v1';
const MAX_FILTERABLE_PRODUCT_ID = 2_147_483_647;
const REVIEWS_PER_PAGE = 100;
const MAX_STORE_REVIEW_PAGES = 1;
const REVIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const EMPTY_REVIEW_CACHE_TTL_MS = 60 * 1000;

type RawReview = {
  id?: number;
  title?: string | null;
  body?: string | null;
  rating?: number;
  created_at?: string;
  curated?: string;
  hidden?: boolean;
  verified?: string | boolean;
  source?: string;
  product_id?: number;
  product_external_id?: string | number;
  reviewer?: {name?: string | null};
  pictures?: Array<{
    hidden?: boolean;
    urls?: {compact?: string; huge?: string; original?: string; small?: string};
  }>;
  product?: {external_id?: string | number};
};

type ReviewsResponse = {reviews?: RawReview[]};
type ProductResponse = {
  product?: {id?: number; external_id?: string | number};
};

export type ProductReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  reviewerName: string;
  createdAt: string | null;
  verified: boolean;
  pictures: Array<{url: string; alt: string}>;
};

export type ProductReviewsResult = {
  reviews: ProductReview[];
  provider: 'Judge.me';
};

type ReviewCacheEntry = {
  expiresAt: number;
  value: Promise<ProductReviewsResult>;
};

const reviewCache = new Map<string, ReviewCacheEntry>();

export async function getJudgeMeProductReviews({
  shopDomain,
  privateApiToken,
  shopifyProductGid,
  cache,
  monitor,
}: {
  shopDomain?: string;
  privateApiToken?: string;
  shopifyProductGid: string;
  cache?: Pick<Cache, 'match' | 'put'>;
  monitor?: Monitor | null;
}): Promise<ProductReviewsResult> {
  if (!shopDomain || !privateApiToken) return emptyResult();

  const externalProductId = shopifyProductGid.split('/').pop();
  if (!externalProductId || !/^\d+$/.test(externalProductId)) return emptyResult();

  const cacheKey = `${shopDomain.toLowerCase()}:${externalProductId}`;
  const cached = reviewCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const entry: ReviewCacheEntry = {
    expiresAt: Date.now() + EMPTY_REVIEW_CACHE_TTL_MS,
    value: getCachedOrLoadReviews({
      cache,
      cacheKey,
      shopDomain,
      privateApiToken,
      externalProductId,
      monitor,
    }),
  };
  reviewCache.set(cacheKey, entry);
  void entry.value.then((result) => {
    entry.expiresAt =
      Date.now() +
      (result.reviews.length ? REVIEW_CACHE_TTL_MS : EMPTY_REVIEW_CACHE_TTL_MS);
  });
  return entry.value;
}

async function getCachedOrLoadReviews({
  cache,
  cacheKey,
  shopDomain,
  privateApiToken,
  externalProductId,
  monitor,
}: {
  cache?: Pick<Cache, 'match' | 'put'>;
  cacheKey: string;
  shopDomain: string;
  privateApiToken: string;
  externalProductId: string;
  monitor?: Monitor | null;
}) {
  const persistentCacheKey = new Request(
    `https://judgeme-cache.internal/reviews/${encodeURIComponent(cacheKey)}`,
  );
  if (cache) {
    try {
      const response = await cache.match(persistentCacheKey);
      if (response) return (await response.json()) as ProductReviewsResult;
    } catch {
      // Cache availability must not affect product rendering.
    }
  }

  const result = await loadJudgeMeProductReviews({
    shopDomain,
    privateApiToken,
    externalProductId,
    monitor,
  });
  if (cache) {
    const ttlSeconds = result.reviews.length ? 900 : 60;
    try {
      await cache.put(
        persistentCacheKey,
        Response.json(result, {
          headers: {'Cache-Control': `public, max-age=${ttlSeconds}`},
        }),
      );
    } catch {
      // The in-memory cache still protects this isolate if edge cache fails.
    }
  }
  return result;
}

async function loadJudgeMeProductReviews({
  shopDomain,
  privateApiToken,
  externalProductId,
  monitor,
}: {
  shopDomain: string;
  privateApiToken: string;
  externalProductId: string;
  monitor?: Monitor | null;
}): Promise<ProductReviewsResult> {
  try {
    const product = await judgeMeFetch<ProductResponse>('/products/-1', {
      shop_domain: shopDomain,
      api_token: privateApiToken,
      external_id: externalProductId,
    });
    const judgeMeProductId = product.product?.id;

    const rawReviews =
      judgeMeProductId && judgeMeProductId <= MAX_FILTERABLE_PRODUCT_ID
        ? await getProductFilteredReviews(shopDomain, privateApiToken, judgeMeProductId)
        : await getStoreReviewsForProduct(
            shopDomain,
            privateApiToken,
            externalProductId,
            judgeMeProductId,
          );

    return {
      provider: 'Judge.me',
      reviews: rawReviews
        .filter(isPublishedReview)
        .map(toPublicReview)
        .filter((review): review is ProductReview => review !== null),
    };
  } catch (error) {
    const reason =
      error instanceof Error && /\(429\)/.test(error.message)
        ? 'quota'
        : error instanceof Error && error.name === 'TimeoutError'
          ? 'timeout'
          : 'upstream';
    monitor?.failure('judgeme.reviews.failure', {reason}, error);
    // Reviews are non-critical. Provider or network failures must not break commerce.
    return emptyResult();
  }
}

export function clearJudgeMeReviewCacheForTests() {
  reviewCache.clear();
}

async function getProductFilteredReviews(
  shopDomain: string,
  privateApiToken: string,
  productId: number,
) {
  const response = await judgeMeFetch<ReviewsResponse>('/reviews', {
    shop_domain: shopDomain,
    api_token: privateApiToken,
    product_id: String(productId),
    published: 'true',
    per_page: String(REVIEWS_PER_PAGE),
  });
  return response.reviews ?? [];
}

async function getStoreReviewsForProduct(
  shopDomain: string,
  privateApiToken: string,
  externalProductId: string,
  judgeMeProductId?: number,
) {
  const matches: RawReview[] = [];

  for (let page = 1; page <= MAX_STORE_REVIEW_PAGES; page += 1) {
    const response = await judgeMeFetch<ReviewsResponse>('/reviews', {
      shop_domain: shopDomain,
      api_token: privateApiToken,
      published: 'true',
      per_page: String(REVIEWS_PER_PAGE),
      page: String(page),
    });
    const reviews = response.reviews ?? [];
    matches.push(
      ...reviews.filter((review) =>
        reviewMatchesProduct(review, externalProductId, judgeMeProductId),
      ),
    );
    if (reviews.length < REVIEWS_PER_PAGE) break;
  }

  return matches;
}

async function judgeMeFetch<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${JUDGEME_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: {Accept: 'application/json'},
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Judge.me request failed (${response.status})`);
  return (await response.json()) as T;
}

function reviewMatchesProduct(
  review: RawReview,
  externalProductId: string,
  judgeMeProductId?: number,
) {
  return (
    String(review.product_external_id ?? '') === externalProductId ||
    String(review.product?.external_id ?? '') === externalProductId ||
    (judgeMeProductId !== undefined && review.product_id === judgeMeProductId)
  );
}

function isPublishedReview(review: RawReview) {
  return review.hidden !== true && (!review.curated || review.curated === 'ok');
}

function toPublicReview(review: RawReview): ProductReview | null {
  const rating = Math.min(5, Math.max(1, Number(review.rating)));
  const body = review.body?.trim();
  if (!review.id || !Number.isFinite(rating) || !body) return null;

  return {
    id: String(review.id),
    rating,
    title: review.title?.trim() || null,
    body,
    reviewerName: review.reviewer?.name?.trim() || 'Tea room guest',
    createdAt: review.created_at || null,
    verified: isVerifiedReview(review),
    pictures: (review.pictures ?? [])
      .filter((picture) => picture.hidden !== true)
      .map(
        (picture) =>
          picture.urls?.huge ||
          picture.urls?.original ||
          picture.urls?.small ||
          picture.urls?.compact,
      )
      .filter((url): url is string => Boolean(url))
      .map(sanitizeReviewImageUrl)
      .filter((url): url is string => Boolean(url))
      .map((url, index) => ({url, alt: `Customer review photo ${index + 1}`})),
  };
}

function isVerifiedReview(review: RawReview) {
  if (review.verified === true) return true;
  const status = String(review.verified ?? review.source ?? '').toLowerCase();
  return ['buyer', 'confirmed-buyer', 'verified-purchase', 'semi-verified-purchase'].includes(status);
}

function emptyResult(): ProductReviewsResult {
  return {reviews: [], provider: 'Judge.me'};
}

function sanitizeReviewImageUrl(value: string) {
  try {
    const url = new URL(value);
    const trustedHost = ['judge.me', 'shopify.com'].some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
    return url.protocol === 'https:' && trustedHost ? url.toString() : null;
  } catch {
    return null;
  }
}
