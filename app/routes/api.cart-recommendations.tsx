import {data} from 'react-router';
import type {Route} from './+types/api.cart-recommendations';
import {measureOptionalStorefront} from '~/lib/monitoring.server';

const MAX_SOURCE_PRODUCTS = 3;
const MAX_EXCLUDED_PRODUCTS = 50;
const MAX_RECOMMENDATIONS = 4;

type RecommendationVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: {amount: string; currencyCode: string};
};

type RecommendationCandidate = {
  id: string;
  selectedOrFirstAvailableVariant: RecommendationVariant | null;
  variants?: {nodes: RecommendationVariant[]};
};

function cheapestAvailableVariant(product: RecommendationCandidate) {
  const available = (product.variants?.nodes ?? []).filter(
    (variant) => variant.availableForSale,
  );
  if (!available.length) return product.selectedOrFirstAvailableVariant;
  return available.reduce((cheapest, variant) =>
    Number(variant.price.amount) < Number(cheapest.price.amount)
      ? variant
      : cheapest,
  );
}

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const productIds = [...new Set(url.searchParams.getAll('productId'))]
    .filter((id) => /^gid:\/\/shopify\/Product\/\d+$/.test(id))
    .slice(0, MAX_SOURCE_PRODUCTS);
  const excludedProductIds = [
    ...new Set([...productIds, ...url.searchParams.getAll('excludeProductId')]),
  ]
    .filter((id) => /^gid:\/\/shopify\/Product\/\d+$/.test(id))
    .slice(0, MAX_EXCLUDED_PRODUCTS);

  if (!productIds.length) {
    throw new Response('Product IDs are required.', {status: 400});
  }

  const recommendationResults = await Promise.all(
    productIds.map((productId) =>
      measureOptionalStorefront(context.monitor, 'cart_product_recommendations', () =>
        context.storefront.query(CART_RECOMMENDATIONS_QUERY, {
          variables: {productId},
          cache: context.storefront.CacheShort({
            maxAge: 60,
            staleWhileRevalidate: 300,
          }),
        }),
      ),
    ),
  );

  if (recommendationResults.every((result) => result === null)) {
    return data({recommendations: [], unavailable: true});
  }

  try {
    const cartProductIds = new Set(excludedProductIds);
    const recommendations = [
      ...new Map(
        recommendationResults
          .flatMap((result) => {
            const recommendedProducts = result?.productRecommendations ?? [];
            const collectionProducts =
              result?.product?.collections.nodes.flatMap(
                (collection: {
                  products: {nodes: typeof recommendedProducts};
                }) => collection.products.nodes,
              ) ?? [];
            return [...recommendedProducts, ...collectionProducts] as RecommendationCandidate[];
          })
          .filter(
            (product) =>
              !cartProductIds.has(product.id) &&
              product.selectedOrFirstAvailableVariant?.availableForSale,
          )
          .map((product) => [product.id, product]),
      ).values(),
    ]
      .slice(0, MAX_RECOMMENDATIONS)
      .map((product) => ({
        ...product,
        selectedOrFirstAvailableVariant: cheapestAvailableVariant(product),
      }));

    return data({recommendations, unavailable: false});
  } catch {
    return data({recommendations: [], unavailable: true});
  }
}

const CART_RECOMMENDATIONS_QUERY = `#graphql
  query CartRecommendations($productId: ID!) {
    product(id: $productId) {
      collections(first: 2) {
        nodes {
          products(first: 4) {
            nodes {
              id
              handle
              title
              featuredImage {
                id
                altText
                url
                width
                height
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              selectedOrFirstAvailableVariant {
                id
                title
                availableForSale
                image {
                  id
                  altText
                  url
                  width
                  height
                }
                price {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                product {
                  id
                  handle
                  title
                  collections(first: 20) { nodes { id } }
                }
              }
              variants(first: 10) {
                nodes {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
    productRecommendations(productId: $productId) {
      id
      handle
      title
      featuredImage {
        id
        altText
        url
        width
        height
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      selectedOrFirstAvailableVariant {
        id
        title
        availableForSale
        image {
          id
          altText
          url
          width
          height
        }
        price {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
        product {
          id
          handle
          title
          collections(first: 20) { nodes { id } }
        }
      }
      variants(first: 10) {
        nodes {
          id
          title
          availableForSale
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;
