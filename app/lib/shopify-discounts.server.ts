import type {
  DiscountProgressData,
  DiscountProgressMilestone,
  DiscountProgressStatus,
  DiscountProgressTargets,
} from './discount-progress';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {safeMonitorFailure, type Monitor} from './monitoring.server';

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
} & ({accessToken: string} | {clientId: string; clientSecret: string});

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
  context?: {all?: 'ALL' | null} | null;
  discountClasses?: string[] | null;
  combinesWith?: {
    orderDiscounts: boolean;
    productDiscounts: boolean;
    shippingDiscounts: boolean;
  } | null;
  minimumRequirement?: {
    __typename: string;
    greaterThanOrEqualToSubtotal?: {
      amount: string;
      currencyCode: MoneyV2['currencyCode'];
    } | null;
  } | null;
  customerGets?: {
    items?: DiscountItemsRecord | null;
    value?: {
      percentage?: number | null;
      amount?: MoneyV2 | null;
      appliesOnEachItem?: boolean | null;
    } | null;
  } | null;
  codes?: {nodes?: Array<{code: string}> | null} | null;
};

type DiscountItemsRecord = {
  __typename?: string | null;
  allItems?: boolean | null;
  products?: {nodes?: Array<{id: string; title?: string | null}> | null} | null;
  productVariants?: {
    nodes?: Array<{
      id: string;
      product?: {id: string; title?: string | null} | null;
    }> | null;
  } | null;
  collections?: {nodes?: Array<{id: string; title?: string | null}> | null} | null;
};

type DiscountQueryResponse = {
  discountNodes?: {nodes?: DiscountRecord[] | null} | null;
};

type DiscountTargetQueryResponse = {
  discountNode?: {
    discount?: {
      customerGets?: {items?: DiscountItemsRecord | null} | null;
    } | null;
  } | null;
};

type AdminGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{message?: string}>;
};

let cachedToken: AdminToken | null = null;
let cachedTokenKey: string | null = null;
let cachedProgress: {expiresAt: number; value: DiscountProgressData} | null = null;

export async function loadShopifyDiscountProgress(
  env: Env,
  monitor: Monitor | null,
): Promise<DiscountProgressData> {
  if (/^(?:0|false|no|off)$/i.test(env.SHOPIFY_DISCOUNT_PROGRESS_ENABLED?.trim() ?? '')) {
    return {status: 'not-configured', milestones: []};
  }

  const credentials = adminCredentials(env);
  if (!credentials) {
    return {status: 'not-configured', milestones: []};
  }

  if (cachedProgress && Date.now() < cachedProgress.expiresAt) {
    return cachedProgress.value;
  }

  return queryActiveDiscounts(credentials)
    .then((value) => {
      cachedProgress = {expiresAt: Date.now() + CACHE_TTL_MS, value};
      return value;
    })
    .catch((error: unknown): DiscountProgressData => {
      safeMonitorFailure(monitor, 'shopify.discount_progress.failure', {}, error);
      const message = error instanceof Error ? error.message : '';
      const status: DiscountProgressStatus =
        /status 401|status 403|read_discounts|access denied|access scope|permission/i.test(
          message,
        )
          ? 'permission-required'
          : 'unavailable';
      return {
        status,
        milestones: [],
      };
    });
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
  const version =
    apiVersion && /^\d{4}-\d{2}$/.test(apiVersion) ? apiVersion : ADMIN_API_VERSION;
  return clientId && clientSecret
    ? {domain, apiVersion: version, clientId, clientSecret}
    : {domain, apiVersion: version, accessToken: accessToken!};
}

async function queryActiveDiscounts(
  credentials: AdminCredentials,
): Promise<DiscountProgressData> {
  const token = await getAdminToken(credentials);
  const result = await requestAdminGraphQL<DiscountQueryResponse>(
    credentials,
    token,
    DISCOUNT_PROGRESS_QUERY,
  );
  const discountNodes = result.discountNodes?.nodes ?? [];
  const now = Date.now();

  for (const node of discountNodes) {
    const discount = node.discount;
    const items = discount?.customerGets?.items;
    const minimumSubtotal = discount?.minimumRequirement?.greaterThanOrEqualToSubtotal;
    if (
      !discount ||
      !discount.__typename.endsWith('Basic') ||
      !isCurrentlyActive(discount, now) ||
      !discount.discountClasses?.some(
        (discountClass) => discountClass === 'ORDER' || discountClass === 'PRODUCT',
      ) ||
      !minimumSubtotal ||
      !Number.isFinite(Number(minimumSubtotal.amount)) ||
      Number(minimumSubtotal.amount) <= 0 ||
      !items ||
      (items.__typename !== 'DiscountProducts' &&
        items.__typename !== 'DiscountCollections')
    ) {
      continue;
    }

    const targetItems = await requestDiscountTargets(credentials, token, node.id);
    if (node.discount?.customerGets) {
      node.discount.customerGets.items = {...items, ...targetItems};
    }
  }

  const milestones = discountNodes
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
            discountClasses: ['SHIPPING'],
            combinesWith: discount.combinesWith ?? undefined,
            productSpecific: false,
            targets: ALL_DISCOUNT_PROGRESS_TARGETS,
          },
        ];
      }

      const customerGets = discount.customerGets;
      const targets = getDiscountProgressTargets(customerGets?.items);
      if (
        !discount.__typename.endsWith('Basic') ||
        !customerGets ||
        !discount.discountClasses?.some(
          (discountClass) => discountClass === 'ORDER' || discountClass === 'PRODUCT',
        ) ||
        !targets
      ) {
        return [];
      }

      const value = customerGets.value;
      const percentage = value?.percentage;
      const fixedAmount = value?.amount;
      const reward =
        typeof percentage === 'number' && percentage > 0 && percentage <= 1
          ? `${new Intl.NumberFormat('en-IN', {
              style: 'percent',
              maximumFractionDigits: 2,
            }).format(percentage)} off`
          : fixedAmount &&
              fixedAmount.currencyCode === subtotal.currencyCode &&
              Number.isFinite(Number(fixedAmount.amount)) &&
              Number(fixedAmount.amount) > 0 &&
              typeof value?.appliesOnEachItem === 'boolean'
            ? `${new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: fixedAmount.currencyCode,
                maximumFractionDigits: 2,
              }).format(
                Number(fixedAmount.amount),
              )} off${value.appliesOnEachItem ? ' each' : ''}`
            : null;
      if (!reward) {
        return [];
      }

      return [
        {
          id: node.id,
          threshold: Number(subtotal.amount),
          currencyCode: subtotal.currencyCode,
          reward,
          title: discount.title || reward,
          method: discount.__typename.startsWith('DiscountCode')
            ? ('code' as const)
            : ('automatic' as const),
          codes: discount.codes?.nodes?.map(({code}) => code) ?? [],
          discountClasses: discount.discountClasses ?? [],
          combinesWith: discount.combinesWith ?? undefined,
          eligibleItems: getDiscountEligibleItems(customerGets.items),
          productSpecific: discount.discountClasses?.includes('PRODUCT') === true,
          targets,
        },
      ];
    })
    .sort((a, b) => a.threshold - b.threshold);

  return {status: 'ready', milestones};
}

const ALL_DISCOUNT_PROGRESS_TARGETS: DiscountProgressTargets = {
  allItems: true,
  productIds: [],
  variantIds: [],
  collectionIds: [],
};

function getDiscountProgressTargets(
  items?: DiscountItemsRecord | null,
): DiscountProgressTargets | null {
  if (items?.allItems === true) return ALL_DISCOUNT_PROGRESS_TARGETS;

  const productIds = items?.products?.nodes?.map(({id}) => id) ?? [];
  const variantIds = items?.productVariants?.nodes?.map(({id}) => id) ?? [];
  const collectionIds = items?.collections?.nodes?.map(({id}) => id) ?? [];
  if (!productIds.length && !variantIds.length && !collectionIds.length) {
    return null;
  }

  return {
    allItems: false,
    productIds,
    variantIds,
    collectionIds,
  };
}

function getDiscountEligibleItems(items?: DiscountItemsRecord | null) {
  const productTitles = [
    ...(items?.products?.nodes ?? []).map(({title}) => title),
    ...(items?.productVariants?.nodes ?? []).map(({product}) => product?.title),
  ].filter((title): title is string => Boolean(title));
  const uniqueProductTitles = [...new Set(productTitles)];
  if (uniqueProductTitles.length) {
    return {kind: 'products' as const, labels: uniqueProductTitles};
  }

  const collectionTitles = (items?.collections?.nodes ?? [])
    .map(({title}) => title)
    .filter((title): title is string => Boolean(title));
  return collectionTitles.length
    ? {kind: 'collections' as const, labels: [...new Set(collectionTitles)]}
    : undefined;
}

async function requestDiscountTargets(
  credentials: AdminCredentials,
  token: string,
  discountId: string,
) {
  const result = await requestAdminGraphQL<DiscountTargetQueryResponse>(
    credentials,
    token,
    DISCOUNT_PROGRESS_TARGETS_QUERY,
    {id: discountId},
  );
  const items = result.discountNode?.discount?.customerGets?.items;
  if (!items) {
    throw new Error('Shopify discount target query returned no target data');
  }
  return items;
}

async function requestAdminGraphQL<T>(
  credentials: AdminCredentials,
  token: string,
  query: string,
  variables?: Record<string, string>,
): Promise<T> {
  const response = await fetch(
    `https://${credentials.domain}/admin/api/${credentials.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Shopify discount query failed with status ${response.status}`);
  }

  const result = (await response.json()) as AdminGraphQLResponse<T>;
  if (result.errors?.length) {
    const messages = result.errors
      .map((item) => item.message)
      .filter((message): message is string => Boolean(message));
    throw new Error(
      messages.length
        ? `Shopify discount query failed: ${messages.join('; ')}`
        : 'Shopify discount query returned GraphQL errors',
    );
  }
  if (!result.data) {
    throw new Error('Shopify discount query returned no data');
  }
  return result.data;
}

function isCurrentlyActive(discount: DiscountRecordData, now: number) {
  if (discount.status !== 'ACTIVE' || discount.context?.all !== 'ALL') {
    return false;
  }
  const startsAt = discount.startsAt ? Date.parse(discount.startsAt) : 0;
  const endsAt = discount.endsAt ? Date.parse(discount.endsAt) : Number.POSITIVE_INFINITY;
  return startsAt <= now && endsAt > now;
}

async function getAdminToken(credentials: AdminCredentials) {
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
  const token = await requestAdminToken(credentials);
  cachedToken = token;
  cachedTokenKey = cacheKey;
  return token.value;
}

async function requestAdminToken(
  credentials: Extract<AdminCredentials, {clientId: string}>,
): Promise<AdminToken> {
  const response = await fetch(`https://${credentials.domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
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
              ... on DiscountBuyerSelectionAll {
                all
              }
            }
            discountClasses
            combinesWith {
              orderDiscounts
              productDiscounts
              shippingDiscounts
            }
            minimumRequirement {
              __typename
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
            customerGets {
              items {
                __typename
                ... on AllDiscountItems {
                  allItems
                }
              }
              value {
                ... on DiscountPercentage {
                  percentage
                }
                ... on DiscountAmount {
                  amount {
                    amount
                    currencyCode
                  }
                  appliesOnEachItem
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
              ... on DiscountBuyerSelectionAll {
                all
              }
            }
            discountClasses
            combinesWith {
              orderDiscounts
              productDiscounts
              shippingDiscounts
            }
            minimumRequirement {
              __typename
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                  currencyCode
                }
              }
            }
            customerGets {
              items {
                __typename
                ... on AllDiscountItems {
                  allItems
                }
              }
              value {
                ... on DiscountPercentage {
                  percentage
                }
                ... on DiscountAmount {
                  amount {
                    amount
                    currencyCode
                  }
                  appliesOnEachItem
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
              ... on DiscountBuyerSelectionAll {
                all
              }
            }
            combinesWith {
              orderDiscounts
              productDiscounts
              shippingDiscounts
            }
            minimumRequirement {
              __typename
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
              ... on DiscountBuyerSelectionAll {
                all
              }
            }
            combinesWith {
              orderDiscounts
              productDiscounts
              shippingDiscounts
            }
            minimumRequirement {
              __typename
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

const DISCOUNT_PROGRESS_TARGETS_QUERY = `#graphql
  query StorefrontProgressDiscountTargets($id: ID!) {
    discountNode(id: $id) {
      discount {
        ... on DiscountAutomaticBasic {
          customerGets {
            items {
              __typename
              ... on AllDiscountItems {
                allItems
              }
              ... on DiscountProducts {
                products(first: 250) {
                  nodes {
                    id
                    title
                  }
                }
                productVariants(first: 250) {
                  nodes {
                    id
                    product {
                      id
                      title
                    }
                  }
                }
              }
              ... on DiscountCollections {
                collections(first: 250) {
                  nodes {
                    id
                    title
                  }
                }
              }
            }
          }
        }
        ... on DiscountCodeBasic {
          customerGets {
            items {
              __typename
              ... on AllDiscountItems {
                allItems
              }
              ... on DiscountProducts {
                products(first: 250) {
                  nodes {
                    id
                    title
                  }
                }
                productVariants(first: 250) {
                  nodes {
                    id
                    product {
                      id
                      title
                    }
                  }
                }
              }
              ... on DiscountCollections {
                collections(first: 250) {
                  nodes {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  }
` as const;
