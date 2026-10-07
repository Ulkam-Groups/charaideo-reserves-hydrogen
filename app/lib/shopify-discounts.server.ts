import type {
  DiscountProgressData,
  DiscountProgressMilestone,
  DiscountProgressStatus,
} from './discount-progress';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {
  safeMonitorFailure,
  type Monitor,
} from './monitoring.server';

const ADMIN_API_VERSION = '2026-07';
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const REQUIRED_SCOPE = 'read_discounts';

type AdminToken = {
  value: string;
  expiresAt: number;
};

type AdminCredentials = {
  domain: string;
  apiVersion: string;
} & (
  | {accessToken: string}
  | {clientId: string; clientSecret: string}
);

type DiscountRecord = {
  id: string;
  discount: DiscountRecordData | null;
};

type DiscountRecordData = {
  __typename: string;
  title?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  context?: {allCustomers?: boolean | null} | null;
  discountClasses?: string[] | null;
  minimumRequirement?: {
    __typename: string;
    greaterThanOrEqualToSubtotal?: {
      amount: string;
      currencyCode: MoneyV2['currencyCode'];
    } | null;
  } | null;
  customerGets?: {
    items?: {allItems?: boolean | null} | null;
    value?: {percentage?: number | null} | null;
  } | null;
  codes?: {nodes?: Array<{code: string}> | null} | null;
};

type DiscountQueryResponse = {
  discountNodes?: {nodes?: DiscountRecord[] | null} | null;
};

let cachedToken: AdminToken | null = null;
let cachedTokenKey: string | null = null;
let tokenRequest: Promise<AdminToken> | null = null;
let cachedProgress: {expiresAt: number; value: DiscountProgressData} | null = null;
let progressRequest: Promise<DiscountProgressData> | null = null;

export async function loadShopifyDiscountProgress(
  env: Env,
  monitor: Monitor | null,
): Promise<DiscountProgressData> {
  const credentials = adminCredentials(env);
  if (!credentials) {
    return {status: 'not-configured', milestones: []};
  }

  if (cachedProgress && Date.now() < cachedProgress.expiresAt) {
    return cachedProgress.value;
  }
  if (progressRequest) return progressRequest;

  const request = queryActiveDiscounts(credentials)
    .then((value) => {
      cachedProgress = {expiresAt: Date.now() + CACHE_TTL_MS, value};
      return value;
    })
    .catch((error: unknown): DiscountProgressData => {
      safeMonitorFailure(monitor, 'shopify.discount_progress.failure', {}, error);
      const message = error instanceof Error ? error.message : '';
      const status: DiscountProgressStatus = /status 401|status 403|read_discounts|access denied|access scope|permission/i.test(message)
        ? 'permission-required'
        : 'unavailable';
      return {
        status,
        milestones: [],
      };
    })
    .finally(() => {
      progressRequest = null;
    });

  progressRequest = request;
  return request;
}

function adminCredentials(env: Env) {
  const domain = (env.SHOPIFY_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN)?.trim();
  const clientId = env.SHOPIFY_ADMIN_CLIENT_ID?.trim();
  const clientSecret = env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim();
  const accessToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  const apiVersion = env.SHOPIFY_ADMIN_API_VERSION?.trim();
  if (
    !domain ||
    !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain) ||
    ((!clientId || !clientSecret) && !accessToken)
  ) {
    return null;
  }
  const version = apiVersion && /^\d{4}-\d{2}$/.test(apiVersion)
    ? apiVersion
    : ADMIN_API_VERSION;
  return clientId && clientSecret
    ? {domain, apiVersion: version, clientId, clientSecret}
    : {domain, apiVersion: version, accessToken: accessToken!};
}

async function queryActiveDiscounts(
  credentials: AdminCredentials,
): Promise<DiscountProgressData> {
  const token = await getAdminToken(credentials);
  const response = await fetch(
    `https://${credentials.domain}/admin/api/${credentials.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query: DISCOUNT_PROGRESS_QUERY}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Shopify discount query failed with status ${response.status}`);
  }

  const result = (await response.json()) as {
    data?: DiscountQueryResponse;
    errors?: Array<{message?: string}>;
  };
  if (result.errors?.length || !result.data?.discountNodes) {
    const messages = result.errors
      ?.map((item) => item.message)
      .filter((message): message is string => Boolean(message));
    throw new Error(
      messages?.length
        ? `Shopify discount query failed: ${messages.join('; ')}`
        : 'Shopify discount query returned no discount data',
    );
  }

  const now = Date.now();
  const milestones = (result.data.discountNodes.nodes ?? [])
    .flatMap((node) => {
      const discount = node.discount;
      if (!discount || !isCurrentlyActive(discount, now)) return [];

      const requirement = discount.minimumRequirement;
      const subtotal = requirement?.greaterThanOrEqualToSubtotal;
      if (
        requirement?.__typename !== 'DiscountMinimumSubtotal' ||
        !subtotal ||
        !Number.isFinite(Number(subtotal.amount)) ||
        Number(subtotal.amount) <= 0
      ) {
        return [];
      }

      if (discount.__typename.endsWith('FreeShipping')) {
        return [
          {
            id: node.id,
            threshold: Number(subtotal.amount),
            currencyCode: subtotal.currencyCode,
            reward: 'Free shipping',
            title: discount.title || 'Free shipping',
            method: discount.__typename.startsWith('DiscountCode')
              ? ('code' as const)
              : ('automatic' as const),
            codes: discount.codes?.nodes?.map(({code}) => code) ?? [],
          },
        ];
      }

      if (
        !discount.__typename.endsWith('Basic') ||
        !discount.discountClasses?.includes('ORDER') ||
        discount.customerGets?.items?.allItems !== true
      ) {
        return [];
      }

      const percentage = discount.customerGets.value?.percentage;
      if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) {
        return [];
      }

      return [
        {
          id: node.id,
          threshold: Number(subtotal.amount),
          currencyCode: subtotal.currencyCode,
          reward: `${percentage}% off`,
          title: discount.title || `${percentage}% off`,
          method: discount.__typename.startsWith('DiscountCode')
            ? ('code' as const)
            : ('automatic' as const),
          codes: discount.codes?.nodes?.map(({code}) => code) ?? [],
        },
      ];
    })
    .sort((a, b) => a.threshold - b.threshold);

  return {status: 'ready', milestones};
}

function isCurrentlyActive(discount: DiscountRecordData, now: number) {
  if (discount.status !== 'ACTIVE' || discount.context?.allCustomers !== true) {
    return false;
  }
  const startsAt = discount.startsAt ? Date.parse(discount.startsAt) : 0;
  const endsAt = discount.endsAt ? Date.parse(discount.endsAt) : Number.POSITIVE_INFINITY;
  return startsAt <= now && endsAt > now;
}

async function getAdminToken(
  credentials: AdminCredentials,
) {
  if ('accessToken' in credentials) {
    return credentials.accessToken;
  }
  const cacheKey = `${credentials.domain}:${credentials.clientId}`;
  if (
    cachedTokenKey === cacheKey &&
    cachedToken &&
    Date.now() < cachedToken.expiresAt - 60_000
  ) {
    return cachedToken.value;
  }
  const request = tokenRequest ?? requestAdminToken(credentials);
  tokenRequest = request;
  try {
    const token = await request;
    cachedToken = token;
    cachedTokenKey = cacheKey;
    return token.value;
  } finally {
    if (tokenRequest === request) tokenRequest = null;
  }
}

async function requestAdminToken(
  credentials: Extract<AdminCredentials, {clientId: string}>,
): Promise<AdminToken> {
  const response = await fetch(
    `https://${credentials.domain}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Shopify Admin authentication failed with status ${response.status}`);
  }

  const token = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
  };
  if (typeof token.access_token !== 'string' || !token.access_token) {
    throw new Error('Shopify Admin authentication returned no access token');
  }

  const scopes =
    typeof token.scope === 'string'
      ? new Set(token.scope.split(/[\s,]+/).filter(Boolean))
      : null;
  if (scopes && !scopes.has(REQUIRED_SCOPE)) {
    throw new Error('Shopify Admin app is missing the read_discounts scope');
  }

  const expiresIn =
    typeof token.expires_in === 'number' && Number.isFinite(token.expires_in)
      ? Math.max(0, token.expires_in)
      : 0;
  return {
    value: token.access_token,
    expiresAt: Date.now() + expiresIn * 1_000,
  };
}

const DISCOUNT_PROGRESS_QUERY = `#graphql
  query StorefrontProgressDiscounts {
    discountNodes(first: 100, query: "status:active") {
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticBasic {
            title
            status
            startsAt
            endsAt
            context {
              ... on DiscountCustomerAll {
                allCustomers
              }
            }
            discountClasses
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
            customerGets {
              items {
                ... on AllDiscountItems {
                  allItems
                }
              }
              value {
                ... on DiscountPercentage {
                  percentage
                }
              }
            }
          }
          ... on DiscountCodeBasic {
            title
            status
            startsAt
            endsAt
            context {
              ... on DiscountCustomerAll {
                allCustomers
              }
            }
            discountClasses
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
            customerGets {
              items {
                ... on AllDiscountItems {
                  allItems
                }
              }
              value {
                ... on DiscountPercentage {
                  percentage
                }
              }
            }
            codes(first: 5) {
              nodes {
                code
              }
            }
          }
          ... on DiscountAutomaticFreeShipping {
            title
            status
            startsAt
            endsAt
            context {
              ... on DiscountCustomerAll {
                allCustomers
              }
            }
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
          }
          ... on DiscountCodeFreeShipping {
            title
            status
            startsAt
            endsAt
            context {
              ... on DiscountCustomerAll {
                allCustomers
              }
            }
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
            codes(first: 5) {
              nodes {
                code
              }
            }
          }
        }
      }
    }
  }
` as const;
