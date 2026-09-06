import type {Route} from './+types/collections.all';
import {Link, useLoaderData} from 'react-router';
import {getPaginationVariables, Image, Money} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {AddToCartButton} from '~/components/AddToCartButton';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

type CatalogProduct = CollectionItemFragment & {
  tastingNotes?: {value: string} | null;
  vendor?: string | null;
  productType?: string | null;
  description?: string | null;
  selectedOrFirstAvailableVariant?: {
    id: string;
    availableForSale: boolean;
  } | null;
};

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Catalog | Charaideo Reserves'},
    {
      name: 'description',
      content:
        'Browse the complete Charaideo Reserves tea catalog and add Assam tea products to your Shopify cart.',
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {...paginationVariables},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
  return {products};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();

  return (
    <div className="collection catalog-page">
      <section className="catalog-hero">
        <span className="eyebrow">Tea catalog</span>
        <h1>The tea cabinet.</h1>
        <p>
          For strong mornings, unhurried afternoons, and conversations that last. Find a tea to make your own.
        </p>
      </section>

      <PaginatedResourceSection<CollectionItemFragment>
        connection={products}
        resourcesClassName="products-grid"
      >
        {({node: product, index}) => (
          <CatalogProductCard
            key={product.id}
            product={product as CatalogProduct}
            loading={index < 8 ? 'eager' : undefined}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );
}

function CatalogProductCard({
  product,
  loading,
}: {
  product: CatalogProduct;
  loading?: 'eager' | 'lazy';
}) {
  const {open} = useAside();
  const image = product.featuredImage;
  const variant = product.selectedOrFirstAvailableVariant;
  const canAddToCart = Boolean(variant?.id && variant.availableForSale);

  return (
    <article className="catalog-card">
      <Link className="catalog-card-image" to={`/products/${product.handle}`} prefetch="intent">
        {image ? (
          <Image
            alt={image.altText || product.title}
            aspectRatio="4/5"
            data={image}
            loading={loading}
            sizes="(min-width: 900px) 28vw, (min-width: 640px) 45vw, 100vw"
          />
        ) : (
          <div className="catalog-card-placeholder" aria-hidden />
        )}
      </Link>
      <div className="catalog-card-body">
        <div>
          <p>{product.productType || product.vendor || 'Assam tea'}</p>
          <h2>
            <Link to={`/products/${product.handle}`} prefetch="intent">
              {product.title}
            </Link>
          </h2>
        </div>
        <p className="catalog-card-description">{product.tastingNotes?.value || product.description || "Discover the story and character of this tea."}</p>
        <div className="catalog-card-footer">
          <strong>
            <Money data={product.priceRange.minVariantPrice} />
          </strong>
          {variant ? (
            <AddToCartButton
              disabled={!canAddToCart}
              onClick={() => open('cart')}
              lines={
                canAddToCart
                  ? [
                      {
                        merchandiseId: variant.id,
                        quantity: 1,
                      },
                    ]
                  : []
              }
            >
              {canAddToCart ? 'Add to cart' : 'Sold out'}
            </AddToCartButton>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    vendor
    productType
    tastingNotes: metafield(namespace: "custom", key: "tasting_notes") { value }
    description
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
` as const;
