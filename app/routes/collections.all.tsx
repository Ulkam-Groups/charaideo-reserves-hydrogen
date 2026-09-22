import type {Route} from './+types/collections.all';
import {Form, useLoaderData} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {measureStorefront} from '~/lib/monitoring.server';

const CATALOG_SORTS = {
  featured: {sortKey: 'BEST_SELLING', reverse: false},
  'price-low': {sortKey: 'PRICE', reverse: false},
  'price-high': {sortKey: 'PRICE', reverse: true},
  newest: {sortKey: 'CREATED_AT', reverse: true},
} as const;

type CatalogSort = keyof typeof CATALOG_SORTS;

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Catalog | Charaideo Reserves™'},
    {
      name: 'description',
      content:
        'Browse the complete Charaideo Reserves™ tea catalog and add Assam tea products to your Shopify cart.',
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
  const requestedSort = new URL(request.url).searchParams.get('sort');
  const sort: CatalogSort =
    requestedSort && requestedSort in CATALOG_SORTS
      ? (requestedSort as CatalogSort)
      : 'featured';
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const [{products}] = await Promise.all([
    measureStorefront(context.monitor, 'catalog', () =>
      storefront.query(CATALOG_QUERY, {
        variables: {...paginationVariables, ...CATALOG_SORTS[sort]},
      }),
    ),
    // Add other queries here, so that they are loaded in parallel
  ]);
  return {products, sort};
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
  const {products, sort} = useLoaderData<typeof loader>();

  return (
    <div className="collection catalog-page">
      <section className="catalog-hero">
        <div className="catalog-intro">
          <span className="eyebrow">The Charaideo collection</span>
          <h1>Tea with<br /><em>a sense of place.</em></h1>
          <p>Discover Assam through everyday favourites and distinctive leaves. Find the tea that fits your moment.</p>
        </div>
        <div className="catalog-hero-art" aria-hidden="true">
          <span className="catalog-hero-art-label">FROM ASSAM, WITH CARE</span>
          <span className="catalog-hero-art-cup"><span /></span>
          <span className="catalog-hero-art-caption">A good cup begins at the garden.</span>
        </div>
      </section>

      <div className="catalog-index" aria-label="Tea catalog guide">
        <span><b>01</b> Orthodox Black Tea</span>
        <span><b>02</b> Green Tea</span>
        <span><b>03</b> Single Grade CTC</span>
        <span><b>04</b> Speciality Tea</span>
      </div>

      <div className="catalog-toolbar">
        <div>
          <span className="eyebrow">The tea cabinet</span>
          <p><strong>{products.nodes.length}</strong> teas currently shown</p>
        </div>
        <Form method="get" className="catalog-sort-form">
          <label htmlFor="catalog-sort">Sort the cabinet</label>
          <div className="catalog-sort-control">
            <select id="catalog-sort" name="sort" defaultValue={sort}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
            <button type="submit">Apply</button>
          </div>
        </Form>
      </div>

      <PaginatedResourceSection<CollectionItemFragment>
        connection={products}
        resourcesClassName="products-grid"
      >
        {({node: product, index}) => (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
            showVariants
          />
        )}
      </PaginatedResourceSection>
    </div>
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
    variants(first: 20) {
      nodes {
        id
        title
        availableForSale
        price {
          ...MoneyCollectionItem
        }
        selectedOptions {
          name
          value
        }
      }
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
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor, sortKey: $sortKey, reverse: $reverse) {
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
