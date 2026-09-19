import {Suspense} from 'react';
import {Await, Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {getJudgeMeProductReviews} from '~/lib/judgeme.server';
import {sanitizeStorefrontHtml} from '~/lib/html.server';
import {ProductReviews} from '~/components/ProductReviews';
import {measureStorefront} from '~/lib/monitoring.server';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: ` ${data?.product.title ?? "Tea"} | Charaideo Reserves`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);
  // Start non-critical reviews after the product ID is known, without blocking HTML.
  const deferredData = loadDeferredData(args, criticalData.product.id);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    measureStorefront(context.monitor, 'product', () =>
      storefront.query(PRODUCT_QUERY, {
        variables: {handle, selectedOptions: getSelectedProductOptions(request)},
      }),
    ),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product: {
      ...product,
      descriptionHtml: sanitizeStorefrontHtml(product.descriptionHtml),
    },
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData(
  {context}: Route.LoaderArgs,
  shopifyProductGid: string,
) {
  return {
    judgeMeReviews: getJudgeMeProductReviews({
      cache: context.reviewsCache,
      shopDomain: context.env.JUDGEME_SHOP_DOMAIN,
      privateApiToken: context.env.JUDGEME_PRIVATE_API_TOKEN,
      shopifyProductGid,
      monitor: context.monitor,
    }),
  };
}

export default function Product() {
  const {product, judgeMeReviews} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const rating = parseRating(product.reviewRating?.value);
  const reviewCount = Number(product.reviewCount?.value || 0);
  const hasReviews = rating !== null && reviewCount > 0;

  return (
    <div className="product-page">
      <section className="product product-purchase">
        <div className="product-gallery">
          <div className="product-origin-tab">Assam / 26.98° N</div>
          <ProductImage
            image={selectedVariant?.image}
            images={product.images.nodes}
          />
          <p className="product-image-caption">Selected from the tea cabinet · packed with care</p>
        </div>
        <div className="product-main">
          <div className="product-index"><span>Reserve / {product.productType || 'Our selection'}</span><span>CR · TEA</span></div>
          <h1>{title}</h1>
          <a className={`product-review-summary${hasReviews ? '' : ' product-review-summary--empty'}`} href="#customer-notes">
            {hasReviews ? (
              <><span className="product-stars" aria-hidden="true">★★★★★</span><strong>{rating.toFixed(1)}</strong><span>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span></>
            ) : (
              <><span className="product-stars" aria-hidden="true">☆☆☆☆☆</span><strong>0 reviews</strong></>
            )}
          </a>
          {product.tastingNotes?.value && <p className="product-taste-line">{product.tastingNotes.value}</p>}
          <ProductPrice
            price={selectedVariant?.price}
            compareAtPrice={selectedVariant?.compareAtPrice}
          />
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
          <ul className="product-assurances" aria-label="Purchase information">
            <li><span aria-hidden="true">◇</span> Packed fresh in Assam</li>
            <li><span aria-hidden="true">◇</span> Shipping calculated at checkout</li>
            <li><span aria-hidden="true">◇</span> Secure checkout</li>
          </ul>
        </div>
      </section>

      <section className="product-information" aria-labelledby="product-story-title">
        <div className="product-story">
          <span className="eyebrow">The character of this cup</span>
          <h2 id="product-story-title">A cup with<br /><em>a sense of place.</em></h2>
          <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
        </div>
        <div className="product-information-sections">
          {product.tastingNotes?.value && <details open><summary>Tasting notes</summary><p>{product.tastingNotes.value}</p></details>}
          <details open><summary>Your brewing ritual</summary><p>{product.brewingSuggestion?.value || 'Follow the brewing directions on your pack. Use freshly drawn water and adjust the steep to your taste.'}</p></details>
          <details><summary>Delivery & care</summary><p>Shipping is calculated at checkout. Keep your tea sealed, cool, and dry, away from strong aromas.</p></details>
        </div>
      </section>

      <section className="product-reviews" id="customer-notes" aria-labelledby="customer-notes-title">
        <div className="product-reviews-heading">
          <span className="eyebrow">From the tea table</span>
          <h2 id="customer-notes-title">Customer notes.</h2>
          <p>Every review shown here is supplied by a connected review service. We never invent customer feedback.</p>
        </div>
        <Suspense fallback={<ReviewsSkeleton />}>
          <Await resolve={judgeMeReviews}>
            {(reviews) => (
              <ProductReviews
                data={reviews}
                fallbackRating={rating}
                fallbackCount={reviewCount}
              />
            )}
          </Await>
        </Suspense>
        <div className="product-reviews-legacy" aria-hidden="true">
        {hasReviews ? (
          <div className="product-rating-panel">
            <strong>{rating.toFixed(1)}</strong>
            <div><span className="product-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>★★★★★</span><p>Based on {reviewCount} customer {reviewCount === 1 ? 'rating' : 'ratings'}.</p></div>
            <p className="product-review-provider-note">Written reviews will appear when the connected provider makes them available to this storefront.</p>
          </div>
        ) : (
          <div className="product-reviews-empty">
            <span aria-hidden="true">◇</span>
            <h3>No customer notes yet.</h3>
            <p>This reserve is waiting for its first verified review. Already tasted it? You can share private feedback directly with our tea room.</p>
            <Link className="text-link" to="/pages/contact">Share feedback →</Link>
          </div>
        )}
        </div>
      </section>

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="product-reviews-loading" aria-label="Loading customer reviews">
      <span />
      <span />
      <span />
    </div>
  );
}

function parseRating(value?: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as {value?: string | number};
    const rating = Number(parsed.value);
    return Number.isFinite(rating) ? rating : null;
  } catch {
    const rating = Number(value);
    return Number.isFinite(rating) ? rating : null;
  }
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    productType
    tastingNotes: metafield(namespace: "custom", key: "tasting_notes") { value }
    brewingSuggestion: metafield(namespace: "custom", key: "brewing_suggestion") { value }
    reviewRating: metafield(namespace: "reviews", key: "rating") { value }
    reviewCount: metafield(namespace: "reviews", key: "rating_count") { value }
    descriptionHtml
    description
    images(first: 10) {
      nodes {
        __typename
        id
        url
        altText
        width
        height
      }
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
