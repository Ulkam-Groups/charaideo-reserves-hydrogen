import {ADMIN_METAFIELD_DEFINITIONS} from './admin-metafields.ts';

const DEFAULT_ADMIN_API_VERSION = '2026-07';
const REQUEST_TIMEOUT_MS = 12_000;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type Credentials = {
  domain: string;
  apiVersion: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
};

type CachedToken = {value: string; expiresAt: number; scopes: Set<string>};
const tokenCache = new Map<string, CachedToken>();

export class ShopifyAdminError extends Error {
  readonly code:
    | 'NOT_CONFIGURED'
    | 'AUTHENTICATION_FAILED'
    | 'ACCESS_DENIED'
    | 'THROTTLED'
    | 'UPSTREAM_FAILED'
    | 'VALIDATION_FAILED';

  constructor(
    message: string,
    code:
      | 'NOT_CONFIGURED'
      | 'AUTHENTICATION_FAILED'
      | 'ACCESS_DENIED'
      | 'THROTTLED'
      | 'UPSTREAM_FAILED'
      | 'VALIDATION_FAILED' = 'UPSTREAM_FAILED',
  ) {
    super(message);
    this.name = 'ShopifyAdminError';
    this.code = code;
  }
}

function credentials(env: Env): Credentials {
  const domain = (
    env.SHOPIFY_PRODUCT_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN
  )?.trim();
  const apiVersion =
    env.SHOPIFY_PRODUCT_ADMIN_API_VERSION?.trim() || DEFAULT_ADMIN_API_VERSION;
  const accessToken = env.SHOPIFY_PRODUCT_ADMIN_ACCESS_TOKEN?.trim();
  const clientId = env.SHOPIFY_PRODUCT_ADMIN_CLIENT_ID?.trim();
  const clientSecret = env.SHOPIFY_PRODUCT_ADMIN_CLIENT_SECRET?.trim();
  if (
    !domain ||
    !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain) ||
    !/^20\d{2}-(?:01|04|07|10)$/.test(apiVersion) ||
    (!accessToken && (!clientId || !clientSecret))
  ) {
    throw new ShopifyAdminError(
      'Shopify Admin API credentials are not configured.',
      'NOT_CONFIGURED',
    );
  }
  return {domain, apiVersion, accessToken, clientId, clientSecret};
}

async function requestWithTimeout(url: string, init: RequestInit, fetcher: typeof fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, {...init, signal: controller.signal});
  } finally {
    clearTimeout(timeout);
  }
}

async function adminToken(config: Credentials, fetcher: typeof fetch) {
  if (config.accessToken) return config.accessToken;
  const cacheKey = `${config.domain}:${config.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cached.value;
  }

  const response = await requestWithTimeout(
    `https://${config.domain}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
      }),
    },
    fetcher,
  );
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
  } | null;
  if (!response.ok || typeof body?.access_token !== 'string') {
    throw new ShopifyAdminError(
      'Shopify rejected the Admin API credentials.',
      'AUTHENTICATION_FAILED',
    );
  }
  const scopes = new Set(
    typeof body.scope === 'string'
      ? body.scope
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : [],
  );
  if (scopes.size && !scopes.has('write_products')) {
    throw new ShopifyAdminError(
      'The installed Shopify app must grant write_products.',
      'ACCESS_DENIED',
    );
  }
  const lifetime =
    typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
      ? body.expires_in * 1_000
      : 23 * 60 * 60 * 1_000;
  tokenCache.set(cacheKey, {
    value: body.access_token,
    expiresAt: Date.now() + lifetime,
    scopes,
  });
  return body.access_token;
}

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: Array<{message?: string; extensions?: {code?: string}}>;
  extensions?: {cost?: {throttleStatus?: {currentlyAvailable?: number}}};
};

async function adminGraphql<T>(
  env: Env,
  query: string,
  variables: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const config = credentials(env);
  const token = await adminToken(config, fetcher);
  const response = await requestWithTimeout(
    `https://${config.domain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    },
    fetcher,
  );
  const envelope = (await response.json().catch(() => null)) as GraphqlEnvelope<T> | null;
  if (response.status === 401 || response.status === 403) {
    throw new ShopifyAdminError(
      'Shopify Admin API authentication failed.',
      'AUTHENTICATION_FAILED',
    );
  }
  if (!response.ok || !envelope) {
    throw new ShopifyAdminError('Shopify Admin API is temporarily unavailable.');
  }
  if (envelope.errors?.length) {
    const denied = envelope.errors.some(
      (error) => error.extensions?.code === 'ACCESS_DENIED',
    );
    const throttled = envelope.errors.some(
      (error) => error.extensions?.code === 'THROTTLED',
    );
    throw new ShopifyAdminError(
      denied
        ? 'The installed Shopify app does not have permission for this operation.'
        : throttled
          ? 'Shopify is busy. Wait a moment and try again.'
          : envelope.errors[0]?.message || 'Shopify rejected the request.',
      denied ? 'ACCESS_DENIED' : throttled ? 'THROTTLED' : 'UPSTREAM_FAILED',
    );
  }
  if (!envelope.data) throw new ShopifyAdminError('Shopify returned no data.');
  return envelope.data;
}

export type AdminProductListItem = {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  totalInventory: number;
  updatedAt: string;
  featuredMedia: null | {
    preview: {image: null | {url: string; altText: string | null}} | null;
  };
  metafields: {nodes: Array<{key: string}>};
};

export async function listAdminProducts(
  env: Env,
  {after, search}: {after?: string | null; search?: string | null},
  fetcher: typeof fetch = fetch,
) {
  const safeSearch = search?.trim().slice(0, 200) || null;
  const data = await adminGraphql<{
    products: {
      nodes: AdminProductListItem[];
      pageInfo: {hasNextPage: boolean; endCursor: string | null};
    };
  }>(
    env,
    `query AdminProducts($after: String, $query: String) {
      products(first: 50, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          id legacyResourceId title handle status vendor totalInventory updatedAt
          featuredMedia { preview { image { url altText } } }
          metafields(first: 50, namespace: "custom") { nodes { key } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {after: after || null, query: safeSearch},
    fetcher,
  );
  return data.products;
}

export type AdminMetafield = {
  id: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest: string | null;
  updatedAt: string;
  definition: null | {name: string; description: string | null};
};

export type AdminVariant = {
  id: string;
  legacyResourceId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  taxable: boolean;
  inventoryPolicy: string;
  inventoryQuantity: number | null;
  selectedOptions: Array<{name: string; value: string}>;
};

export type AdminProduct = {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  templateSuffix: string | null;
  totalInventory: number;
  updatedAt: string;
  category: null | {
    id: string;
    name: string;
    fullName: string;
    ancestorIds: string[];
    attributes: {
      nodes: Array<{
        __typename: string;
        id: string;
        name: string;
        values?: {nodes: Array<{id: string; name: string}>};
      }>;
    };
  };
  taxonomyCategories: Array<{id: string; fullName: string}>;
  taxonomyMetafieldDefinitions: Array<{
    namespace: string;
    key: string;
    name: string;
    type: {name: string};
    constraints: null | {
      key: string | null;
      values: {nodes: Array<{value: string}>};
    };
  }>;
  seo: {title: string | null; description: string | null};
  priceRangeV2: {
    minVariantPrice: {amount: string; currencyCode: string};
    maxVariantPrice: {amount: string; currencyCode: string};
  };
  variants: {nodes: AdminVariant[]};
  metafields: {nodes: AdminMetafield[]};
  collections: {nodes: Array<{id: string; title: string; handle: string}>};
  media: {
    nodes: Array<{
      id: string;
      alt: string | null;
      mediaContentType: string;
      preview: {image: null | {url: string; altText: string | null}} | null;
    }>;
  };
};

export async function getAdminProduct(
  env: Env,
  legacyResourceId: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^\d+$/.test(legacyResourceId)) return null;
  type TaxonomyDefinition = AdminProduct['taxonomyMetafieldDefinitions'][number];
  const data = await adminGraphql<{
    product: Omit<AdminProduct, 'taxonomyCategories' | 'taxonomyMetafieldDefinitions'> | null;
    taxonomy: {categories: {nodes: Array<{id: string; fullName: string}>}};
    teaInputTypeDefinition: TaxonomyDefinition | null;
    tasteProfileDefinition: TaxonomyDefinition | null;
  }>(
    env,
    `query AdminProduct($id: ID!) {
      product(id: $id) {
        id legacyResourceId title handle descriptionHtml vendor productType status tags
        templateSuffix totalInventory updatedAt
        category {
          id name fullName ancestorIds
          attributes(first: 100) {
            nodes {
              __typename
              ... on TaxonomyChoiceListAttribute {
                id name
                values(first: 100) { nodes { id name } }
              }
            }
          }
        }
        seo { title description }
        priceRangeV2 {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        collections(first: 50) { nodes { id title handle } }
        media(first: 50) {
          nodes { id alt mediaContentType preview { image { url altText } } }
        }
        variants(first: 100) {
          nodes {
            id legacyResourceId title sku barcode price compareAtPrice taxable
            inventoryPolicy inventoryQuantity selectedOptions { name value }
          }
        }
        metafields(first: 250) {
          nodes {
            id namespace key type value compareDigest updatedAt
            definition { name description }
          }
        }
      }
      taxonomy {
        categories(first: 50, search: "Tea") { nodes { id fullName } }
      }
      teaInputTypeDefinition: metafieldDefinition(identifier: {
        ownerType: PRODUCT, namespace: "shopify", key: "tea-input-type"
      }) {
        namespace key name type { name }
        constraints { key values(first: 250) { nodes { value } } }
      }
      tasteProfileDefinition: metafieldDefinition(identifier: {
        ownerType: PRODUCT, namespace: "shopify", key: "taste-profile"
      }) {
        namespace key name type { name }
        constraints { key values(first: 250) { nodes { value } } }
      }
    }`,
    {id: `gid://shopify/Product/${legacyResourceId}`},
    fetcher,
  );
  if (!data.product) return null;
  return {
    ...data.product,
    taxonomyCategories: data.taxonomy.categories.nodes,
    taxonomyMetafieldDefinitions: [
      data.teaInputTypeDefinition,
      data.tasteProfileDefinition,
    ].filter((definition): definition is TaxonomyDefinition => definition !== null),
  };
}

type UserError = {field?: string[] | null; message: string; code?: string | null};

function assertNoUserErrors(errors: UserError[], operation: string) {
  if (!errors.length) return;
  throw new ShopifyAdminError(
    `${operation}: ${errors.map((error) => error.message).join('; ')}`,
    'VALIDATION_FAILED',
  );
}

export type ProductUpdateValues = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  templateSuffix: string;
  seo: {title: string; description: string};
  category?: string;
};

export type VariantUpdateValues = {
  id: string;
  price: string;
  compareAtPrice?: string | null;
  sku?: string | null;
  barcode?: string | null;
  taxable: boolean;
  inventoryPolicy: string;
};

export type MetafieldUpdateValues = {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest?: string | null;
};

function sameStrings(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

export function hasAdminProductChanges(current: AdminProduct, next: ProductUpdateValues) {
  return (
    next.title !== current.title ||
    next.handle !== current.handle ||
    next.descriptionHtml !== current.descriptionHtml ||
    next.vendor !== current.vendor ||
    next.productType !== current.productType ||
    next.status !== current.status ||
    !sameStrings(next.tags, current.tags) ||
    next.templateSuffix !== (current.templateSuffix ?? '') ||
    next.seo.title !== (current.seo.title ?? '') ||
    next.seo.description !== (current.seo.description ?? '') ||
    (next.category !== undefined && next.category !== (current.category?.id ?? ''))
  );
}

export function changedAdminVariants(
  current: AdminVariant[],
  next: VariantUpdateValues[],
) {
  const currentById = new Map(current.map((variant) => [variant.id, variant]));
  return next.filter((variant) => {
    const existing = currentById.get(variant.id);
    return (
      !existing ||
      variant.price !== existing.price ||
      (variant.compareAtPrice ?? null) !== existing.compareAtPrice ||
      (variant.sku ?? null) !== existing.sku ||
      (variant.barcode ?? null) !== existing.barcode ||
      variant.taxable !== existing.taxable ||
      variant.inventoryPolicy !== existing.inventoryPolicy
    );
  });
}

export async function updateAdminProduct(
  env: Env,
  input: ProductUpdateValues,
  fetcher: typeof fetch = fetch,
) {
  const data = await adminGraphql<{
    productUpdate: {
      product: {id: string; handle: string} | null;
      userErrors: UserError[];
    };
  }>(
    env,
    `mutation UpdateAdminProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle }
        userErrors { field message }
      }
    }`,
    {product: input},
    fetcher,
  );
  assertNoUserErrors(data.productUpdate.userErrors, 'Product update failed');
  if (!data.productUpdate.product)
    throw new ShopifyAdminError('Product update returned no product.');
  return data.productUpdate.product;
}

export async function updateAdminVariants(
  env: Env,
  productId: string,
  variants: VariantUpdateValues[],
  fetcher: typeof fetch = fetch,
) {
  if (!variants.length) return;
  const data = await adminGraphql<{
    productVariantsBulkUpdate: {userErrors: UserError[]};
  }>(
    env,
    `mutation UpdateAdminVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
        userErrors { field message code }
      }
    }`,
    {productId, variants},
    fetcher,
  );
  assertNoUserErrors(data.productVariantsBulkUpdate.userErrors, 'Variant update failed');
}

export async function setAdminMetafields(
  env: Env,
  metafields: MetafieldUpdateValues[],
  fetcher: typeof fetch = fetch,
) {
  for (let offset = 0; offset < metafields.length; offset += 25) {
    const batch = metafields.slice(offset, offset + 25);
    const data = await adminGraphql<{
      metafieldsSet: {userErrors: UserError[]};
    }>(
      env,
      `mutation SetAdminMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message code }
        }
      }`,
      {metafields: batch},
      fetcher,
    );
    assertNoUserErrors(data.metafieldsSet.userErrors, 'Metafield update failed');
  }
}

export async function ensureAdminMetafieldDefinitions(
  env: Env,
  fetcher: typeof fetch = fetch,
) {
  const existing = await adminGraphql<{
    metafieldDefinitions: {nodes: Array<{namespace: string; key: string}>};
  }>(
    env,
    `query AdminMetafieldDefinitions {
      metafieldDefinitions(first: 250, ownerType: PRODUCT, namespace: "custom") {
        nodes { namespace key }
      }
    }`,
    {},
    fetcher,
  );
  const existingKeys = new Set(existing.metafieldDefinitions.nodes.map(({key}) => key));
  const missing = ADMIN_METAFIELD_DEFINITIONS.filter(({key}) => !existingKeys.has(key));

  for (let offset = 0; offset < missing.length; offset += 10) {
    const batch = missing.slice(offset, offset + 10);
    const declarations = batch
      .map((_, index) => `$d${index}: MetafieldDefinitionInput!`)
      .join(', ');
    const selections = batch
      .map(
        (_, index) => `d${index}: metafieldDefinitionCreate(definition: $d${index}) {
          createdDefinition { id key }
          userErrors { field message code }
        }`,
      )
      .join('\n');
    const variables = Object.fromEntries(
      batch.map((definition, index) => [
        `d${index}`,
        {
          name: definition.label,
          namespace: 'custom',
          key: definition.key,
          type: definition.type,
          ownerType: 'PRODUCT',
          access: {storefront: 'PUBLIC_READ'},
          ...(definition.min === undefined
            ? {}
            : {
                validations: [
                  {name: 'min', value: String(definition.min)},
                  {name: 'max', value: String(definition.max)},
                ],
              }),
        },
      ]),
    );
    const result = await adminGraphql<Record<string, {userErrors: UserError[]}>>(
      env,
      `mutation CreateAdminMetafieldDefinitions(${declarations}) { ${selections} }`,
      variables,
      fetcher,
    );
    for (const [index, payload] of Object.values(result).entries()) {
      assertNoUserErrors(
        payload.userErrors,
        `Definition ${batch[index]?.label ?? index} failed`,
      );
    }
  }
  return {created: missing.length, existing: existingKeys.size};
}
