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
import {ProductItem} from '~/components/ProductItem';
import {measureStorefront} from '~/lib/monitoring.server';
import type {ProductFragment} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: ` ${data?.product.title ?? "Tea"} | Charaideo Reserves™`},
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
    relatedProducts: loadRelatedProducts(context, shopifyProductGid),
  };
}

async function loadRelatedProducts(
  context: Route.LoaderArgs['context'],
  productId: string,
) {
  try {
    const {product, productRecommendations} = await context.storefront.query(
      RELATED_PRODUCTS_QUERY,
      {variables: {productId}},
    );
    const sourceCollections = new Set(
      product?.collections.nodes.map((collection) => collection.id) ?? [],
    );
    const candidates = [
      ...(productRecommendations ?? []),
      ...(product?.collections.nodes.flatMap(
        (collection) => collection.products.nodes,
      ) ?? []),
    ];
    const uniqueCandidates = [
      ...new Map(
        candidates
          .filter((candidate) => candidate.id !== productId)
          .map((candidate) => [candidate.id, candidate]),
      ).values(),
    ];

    // Product tags require an additional Storefront API scope. Keep the
    // collection fallback useful even when that optional permission is absent.
    const productTags = await loadRelatedProductTags(context, [
      productId,
      ...uniqueCandidates.map((candidate) => candidate.id),
    ]);
    const sourceTags = productTags.get(productId) ?? new Set<string>();

    return uniqueCandidates
      .map((candidate, index) => ({
        candidate,
        index,
        tagMatches: [...(productTags.get(candidate.id) ?? [])].filter((tag) =>
          sourceTags.has(tag),
        ).length,
        collectionMatches: candidate.collections.nodes.filter((collection) =>
          sourceCollections.has(collection.id),
        ).length,
      }))
      .sort(
        (left, right) =>
          right.tagMatches - left.tagMatches ||
          right.collectionMatches - left.collectionMatches ||
          left.index - right.index,
      )
      .slice(0, 4)
      .map(({candidate}) => candidate);
  } catch {
    // Recommendations are non-critical and must never prevent the PDP rendering.
    return [];
  }
}

async function loadRelatedProductTags(
  context: Route.LoaderArgs['context'],
  productIds: string[],
) {
  const tagsByProduct = new Map<string, Set<string>>();

  if (productIds.length === 0) return tagsByProduct;

  try {
    const {nodes} = await context.storefront.query(RELATED_PRODUCT_TAGS_QUERY, {
      variables: {productIds},
    });

    for (const node of nodes) {
      if (node?.__typename === 'Product') {
        tagsByProduct.set(node.id, new Set(node.tags));
      }
    }
  } catch {
    // The unauthenticated_read_product_tags scope is optional. Collection
    // matches still provide a deterministic fallback without this scope.
  }

  return tagsByProduct;
}

export default function Product() {
  const {product, judgeMeReviews, relatedProducts} = useLoaderData<typeof loader>();

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

      <TeaSpecifications product={product} selectedVariant={selectedVariant} />

      <section className="product-reviews" id="customer-notes" aria-labelledby="customer-notes-title">
        <div className="product-reviews-heading">
          <span className="eyebrow">From the tea table</span>
          <h2 id="customer-notes-title">Reviews & questions.</h2>
          <p>Verified reviews are supplied by Judge.me. Customer questions will appear here when Judge.me Q&amp;A is enabled.</p>
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

      <Suspense fallback={null}>
        <Await resolve={relatedProducts}>
          {(products) =>
            products.length > 0 && (
              <section className="product-related" aria-labelledby="related-products-title">
                <div className="editorial-heading">
                  <div>
                    <span className="eyebrow">Continue exploring</span>
                    <h2 id="related-products-title">You may also enjoy.</h2>
                    <p>Selected by shared tea tags and collections.</p>
                  </div>
                  <Link className="text-link" to="/collections/all">
                    Shop all teas →
                  </Link>
                </div>
                <div className="recommended-products-grid">
                  {products.map((relatedProduct) => (
                    <ProductItem key={relatedProduct.id} product={relatedProduct} />
                  ))}
                </div>
              </section>
            )
          }
        </Await>
      </Suspense>

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

function TeaSpecifications({
  product,
  selectedVariant,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
}) {
  const selectedWeight = selectedVariant?.selectedOptions.find((option) =>
    /size|weight|pack/i.test(option.name),
  )?.value;
  const harvest = [
    product.harvest?.value,
    product.flush?.value,
    product.pluckDate?.value,
  ]
    .filter(Boolean)
    .join(' · ');
  const specifications = [
    ['Net weight', product.netWeight?.value || selectedWeight],
    ['Origin', product.origin?.value || product.estate?.value],
    ['Cultivar', product.cultivar?.value],
    ['Grade', product.grade?.value],
    ['Harvest', harvest],
    ['Ingredients', product.ingredients?.value],
    ['Caffeine level', product.caffeineLevel?.value],
    ['Tasting notes', product.tastingNotes?.value],
    ['Preparation', product.brewingSuggestion?.value],
    ['Storage', product.storage?.value],
    ['Shelf life', product.shelfLife?.value],
    ['Allergens', product.allergens?.value],
    ['Certifications', product.certifications?.value],
  ] as const;

  return (
    <section
      className="product-specifications"
      aria-labelledby="tea-specifications-title"
    >
      <div className="product-specifications-heading">
        <span className="eyebrow">Nothing hidden</span>
        <h2 id="tea-specifications-title">Every detail, clearly stated.</h2>
        <p>
          These specifications come directly from this tea’s Shopify product
          record. Missing information is labelled instead of guessed.
        </p>
      </div>
      <dl className="product-specifications-grid">
        {specifications.map(([label, rawValue]) => {
          const value = formatSpecification(rawValue);
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value ? undefined : 'is-missing'}>
                {value || 'Not yet provided'}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function formatSpecification(value?: string | null) {
  if (!value?.trim()) return '';

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.join(', ');
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      const measurement = parsed as {value?: string | number; unit?: string};
      if (measurement.value == null) return value;
      const units: Record<string, string> = {
        GRAMS: 'g',
        KILOGRAMS: 'kg',
        OUNCES: 'oz',
        POUNDS: 'lb',
      };
      return `${measurement.value}${measurement.unit ? ` ${units[measurement.unit] || measurement.unit.toLowerCase()}` : ''}`;
    }
  } catch {
    // Plain-text metafields are already display-ready.
  }

  return value;
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
    currentlyNotInStock
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
    netWeight: metafield(namespace: "custom", key: "net_weight") { value }
    origin: metafield(namespace: "custom", key: "origin") { value }
    estate: metafield(namespace: "custom", key: "estate") { value }
    cultivar: metafield(namespace: "custom", key: "cultivar") { value }
    grade: metafield(namespace: "custom", key: "grade") { value }
    harvest: metafield(namespace: "custom", key: "harvest") { value }
    flush: metafield(namespace: "custom", key: "flush") { value }
    pluckDate: metafield(namespace: "custom", key: "pluck_date") { value }
    ingredients: metafield(namespace: "custom", key: "ingredients") { value }
    caffeineLevel: metafield(namespace: "custom", key: "caffeine_level") { value }
    storage: metafield(namespace: "custom", key: "storage") { value }
    shelfLife: metafield(namespace: "custom", key: "shelf_life") { value }
    allergens: metafield(namespace: "custom", key: "allergens") { value }
    certifications: metafield(namespace: "custom", key: "certifications") { value }
    reviewRating: metafield(namespace: "reviews", key: "rating") { value }
    reviewCount: metafield(namespace: "reviews", key: "rating_count") { value }
    descriptionHtml
    description
    images(first: 250) {
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

const RELATED_PRODUCTS_QUERY = `#graphql
  fragment RelatedProductMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment RelatedProductCard on Product {
    id
    handle
    title
    description
    productType
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...RelatedProductMoney
      }
      maxVariantPrice {
        ...RelatedProductMoney
      }
    }
    collections(first: 10) {
      nodes {
        id
      }
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query ProductRecommendations(
    $country: CountryCode
    $language: LanguageCode
    $productId: ID!
  ) @inContext(country: $country, language: $language) {
    product(id: $productId) {
      collections(first: 3) {
        nodes {
          id
          products(first: 8) {
            nodes {
              ...RelatedProductCard
            }
          }
        }
      }
    }
    productRecommendations(productId: $productId) {
      ...RelatedProductCard
    }
  }
` as const;

const RELATED_PRODUCT_TAGS_QUERY = `#graphql
  query RelatedProductTags(
    $country: CountryCode
    $language: LanguageCode
    $productIds: [ID!]!
  ) @inContext(country: $country, language: $language) {
    nodes(ids: $productIds) {
      __typename
      ... on Product {
        id
        tags
      }
    }
  }
` as const;
