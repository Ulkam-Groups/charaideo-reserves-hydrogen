import {Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {measureStorefront} from '~/lib/monitoring.server';
import type {ReserveCollection} from '~/lib/reserve-list';
import {ReserveTeaCard} from './reserve-list';

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `${data?.collection.title ?? 'Collection'} | Charaideo Reserves™`}];
};

export async function loader(args: Route.LoaderArgs) {
  // Collection pages are intentionally disabled. Remove this redirect to restore the preserved implementation below.
  const collectionPagesEnabled = false;
  if (!collectionPagesEnabled) return redirect('/reserve-list', 301);

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
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    measureStorefront(context.monitor, 'collection', () =>
      storefront.query(COLLECTION_QUERY, {
        variables: {handle, ...paginationVariables},
        // Add other queries here, so that they are loaded in parallel
      }),
    ),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
  };
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
  const {collection} = useLoaderData<typeof loader>();

  return (
    <div className="collection collection-listing">
      <header className="listing-hero">
        <div className="listing-hero-inner">
          <nav className="listing-breadcrumb" aria-label="Breadcrumb">
            <Link prefetch="none" to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link prefetch="none" to="/reserve-list">Reserve List</Link>
            <span aria-hidden="true">/</span>
            <span>{collection.title}</span>
          </nav>
          <span className="eyebrow">Charaideo Reserves collection</span>
          <h1>{collection.title}</h1>
          {collection.description && (
            <p className="collection-description">{collection.description}</p>
          )}
          <Link className="listing-hero-link" prefetch="none" to="/reserve-list">
            Explore the Reserve List
          </Link>
        </div>
      </header>
      <PaginatedResourceSection<ReserveCollection['products'][number]>
        connection={collection.products}
        resourcesClassName="reserve-products-grid reserve-products-grid--collections collection-reserve-products"
      >
        {({node: product, index}) => (
          <ReserveTeaCard
            key={product.id}
            product={product}
            collectionTitle={collection.title}
          />
        )}
      </PaginatedResourceSection>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionReserveProductItem on Product {
    id
    handle
    title
    description
    tags
    availableForSale
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    variants(first: 25) {
      nodes {
        id
        title
        availableForSale
        selectedOptions { name value }
        price { ...MoneyProductItem }
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...CollectionReserveProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;

