import {data} from 'react-router';
import type {Route} from './+types/api.cart-recommendations';
import {
  measureOptionalStorefront,
  safeMonitorFailure,
} from '~/lib/monitoring.server';

const MAX_SOURCE_PRODUCTS = 3;
const MAX_EXCLUDED_PRODUCTS = 50;
const MAX_RECOMMENDATIONS = 2;

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

  try {
    const recommendationResults = await Promise.all(
      productIds.map((productId) =>
        measureOptionalStorefront(
          context.monitor,
          'cart_product_recommendations',
          () =>
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

    const cartProductIds = new Set(excludedProductIds);
    const rankedCandidates = new Map<
      string,
      {product: RecommendationCandidate; relevance: number; firstSeen: number}
    >();
    let firstSeen = 0;
    const rankCandidate = (
      product: RecommendationCandidate,
      relevance: number,
    ) => {
      if (cartProductIds.has(product.id)) return;
      const existing = rankedCandidates.get(product.id);
      if (existing) {
        existing.relevance += relevance;
        return;
      }
      rankedCandidates.set(product.id, {product, relevance, firstSeen: firstSeen++});
    };

    recommendationResults.forEach((result) => {
      const directRecommendations = (result?.productRecommendations ?? []) as RecommendationCandidate[];
      directRecommendations.forEach((product, index) =>
        rankCandidate(product, 100 - index * 5),
      );

      result?.product?.collections.nodes.forEach(
        (collection: {products: {nodes: RecommendationCandidate[]}}) => {
          collection.products.nodes.forEach((product, index) =>
            rankCandidate(product, 30 - index * 2),
          );
        },
      );
    });

    const recommendations = [...rankedCandidates.values()]
      .map(({product, relevance, firstSeen}) => ({
        product: {
          ...product,
          selectedOrFirstAvailableVariant: cheapestAvailableVariant(product),
        },
        relevance,
        firstSeen,
      }))
      .filter(({product}) => product.selectedOrFirstAvailableVariant?.availableForSale)
      .sort((left, right) => {
        if (right.relevance !== left.relevance) return right.relevance - left.relevance;
        const priceDifference =
          Number(left.product.selectedOrFirstAvailableVariant?.price.amount ?? Infinity) -
          Number(right.product.selectedOrFirstAvailableVariant?.price.amount ?? Infinity);
        return priceDifference || left.firstSeen - right.firstSeen;
      })
      .slice(0, MAX_RECOMMENDATIONS)
      .map(({product}) => product);

    return data({recommendations, unavailable: false});
  } catch (error) {
    safeMonitorFailure(
      context.monitor,
      'cart_product_recommendations.loader_failure',
      {sourceProductCount: productIds.length},
      error,
    );
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
