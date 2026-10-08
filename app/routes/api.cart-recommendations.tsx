import {data} from 'react-router';
import type {Route} from './+types/api.cart-recommendations';
import {measureOptionalStorefront} from '~/lib/monitoring.server';

const MAX_SOURCE_PRODUCTS = 3;
const MAX_RECOMMENDATIONS = 4;

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const productIds = [...new Set(url.searchParams.getAll('productId'))]
    .filter((id) => /^gid:\/\/shopify\/Product\/\d+$/.test(id))
    .slice(0, MAX_SOURCE_PRODUCTS);

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

  const cartProductIds = new Set(productIds);
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
          return [...recommendedProducts, ...collectionProducts];
        })
        .filter(
          (product) =>
            !cartProductIds.has(product.id) &&
            product.selectedOrFirstAvailableVariant?.availableForSale,
        )
        .map((product) => [product.id, product]),
    ).values(),
  ].slice(0, MAX_RECOMMENDATIONS);

  return data({recommendations, unavailable: false});
}

const CART_RECOMMENDATIONS_QUERY = `#graphql
  query CartRecommendations($productId: ID!) {
    product(id: $productId) {
      collections(first: 3) {
        nodes {
          products(first: 8) {
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
                availableForSale
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
        availableForSale
      }
    }
  }
` as const;
