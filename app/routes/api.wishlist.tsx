import {data} from 'react-router';
import type {Route} from './+types/api.wishlist';
import {safeMonitorFailure} from '~/lib/monitoring.server';

const MAX_WISHLIST_PRODUCTS = 50;
const PRODUCT_ID = /^gid:\/\/shopify\/Product\/\d+$/;

type WishlistProductNode = {
  __typename: 'Product';
  id: string;
  handle: string;
  title: string;
  featuredImage?: {url: string; altText?: string | null} | null;
  priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
};

export async function loader({context}: Route.LoaderArgs) {
  if (!(await context.customerAccount.isLoggedIn())) {
    return data({authenticated: false, products: []});
  }

  try {
    const {data: customerData, errors} = await context.customerAccount.query(
      WISHLIST_CUSTOMER_QUERY,
      {variables: {language: context.customerAccount.i18n.language}},
    );
    if (errors?.length || !customerData?.customer) throw new Error('Unable to read wishlist');

    const productIds = parseProductIds(customerData.customer.metafield?.value);
    if (!productIds.length) return data({authenticated: true, products: []});

    const {nodes} = await context.storefront.query(WISHLIST_PRODUCTS_QUERY, {
      variables: {ids: productIds},
      cache: context.storefront.CacheShort({maxAge: 60, staleWhileRevalidate: 300}),
    });

    const products = (nodes as Array<WishlistProductNode | null>)
      .filter((node): node is WishlistProductNode => node?.__typename === 'Product')
      .map((product: WishlistProductNode) => ({
        id: product.id,
        handle: product.handle,
        title: product.title,
        image: product.featuredImage,
        price: product.priceRange.minVariantPrice,
      }));

    return data({authenticated: true, products});
  } catch (error) {
    safeMonitorFailure(context.monitor, 'customer_wishlist.read_failure', {}, error);
    return data({authenticated: true, products: [], unavailable: true});
  }
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') return data({error: 'Method not allowed'}, {status: 405});
  if (!(await context.customerAccount.isLoggedIn())) {
    return data({authenticated: false, saved: false}, {status: 401});
  }

  try {
    const body = (await request.json()) as {productIds?: unknown};
    const productIds = Array.isArray(body.productIds)
      ? [...new Set(body.productIds.filter((id): id is string => typeof id === 'string' && PRODUCT_ID.test(id)))]
          .slice(0, MAX_WISHLIST_PRODUCTS)
      : [];
    const {data: customerData, errors: customerErrors} =
      await context.customerAccount.query(WISHLIST_CUSTOMER_ID_QUERY, {
        variables: {language: context.customerAccount.i18n.language},
      });
    if (customerErrors?.length || !customerData?.customer?.id) {
      throw new Error('Unable to identify customer');
    }

    const {data: mutationData, errors} = await context.customerAccount.mutate(
      WISHLIST_SET_MUTATION,
      {
        variables: {
          language: context.customerAccount.i18n.language,
          metafields: [
            {
              ownerId: customerData.customer.id,
              namespace: 'custom',
              key: 'wishlist_products',
              type: 'list.product_reference',
              value: JSON.stringify(productIds),
            },
          ],
        },
      },
    );
    const userErrors = mutationData?.metafieldsSet?.userErrors ?? [];
    if (errors?.length || userErrors.length) throw new Error('Unable to save wishlist');

    return data({authenticated: true, saved: true, productIds});
  } catch (error) {
    safeMonitorFailure(context.monitor, 'customer_wishlist.write_failure', {}, error);
    return data({authenticated: true, saved: false}, {status: 503});
  }
}

function parseProductIds(value?: string | null) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && PRODUCT_ID.test(id)).slice(0, MAX_WISHLIST_PRODUCTS)
      : [];
  } catch {
    return [];
  }
}

const WISHLIST_CUSTOMER_QUERY = `#graphql
  query WishlistCustomer($language: LanguageCode)
    @inContext(language: $language) {
    customer {
      id
      metafield(namespace: "custom", key: "wishlist_products") {
        value
      }
    }
  }
` as const;

const WISHLIST_CUSTOMER_ID_QUERY = `#graphql
  query WishlistCustomerId($language: LanguageCode)
    @inContext(language: $language) {
    customer { id }
  }
` as const;

const WISHLIST_SET_MUTATION = `#graphql
  mutation WishlistSet($metafields: [MetafieldsSetInput!]!, $language: LanguageCode)
    @inContext(language: $language) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message code }
    }
  }
` as const;

const WISHLIST_PRODUCTS_QUERY = `#graphql
  query WishlistProducts($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        id
        handle
        title
        featuredImage {url altText width height}
        priceRange {minVariantPrice {amount currencyCode}}
      }
    }
  }
` as const;
