import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
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
async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    featuredCollection: collections.nodes[0],
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();

  return (
    <main className="home-page">
      {data.isShopLinked ? null : <MockShopNotice />}

      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Small-batch Assam tea</span>
          <h1>Crafted for slow mornings and deep conversations.</h1>
          <p>
            Discover single-origin Assam tea with bold malt character, floral
            aroma, and the polished finish of a truly exceptional cup.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/collections/all">
              Shop teas
            </Link>
            <Link className="button secondary" to="/collections/all">
              Explore blends
            </Link>
          </div>
          <ul className="hero-metrics" aria-label="Brand stats">
            <li>
              <strong>100%</strong>
              <span>Assam heritage</span>
            </li>
            <li>
              <strong>48h</strong>
              <span>fresh roast</span>
            </li>
            <li>
              <strong>4.9/5</strong>
              <span>tea club rating</span>
            </li>
          </ul>
        </div>

        <div className="hero-visual">
          <FeaturedCollection collection={data.featuredCollection} />
        </div>
      </section>

      <section className="home-features" aria-label="Tea advantages">
        <article>
          <span>01</span>
          <h3>Single-origin sourcing</h3>
          <p>Handpicked gardens and small-batch processing for a clean, vibrant cup.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Freshly packed</h3>
          <p>Every order is sealed to preserve aroma, body, and the natural character of Assam.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Perfect for rituals</h3>
          <p>From brisk breakfast cups to slow afternoon infusions, there’s a tea for every moment.</p>
        </article>
      </section>

      <section className="home-banner">
        <p>Explore our signature Assam collection</p>
        <Link to="/collections/all">View collection</Link>
      </section>

      <RecommendedProducts products={data.recommendedProducts} />
    </main>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;

  return (
    <Link className="featured-collection" to={`/collections/${collection.handle}`}>
      {image && (
        <div className="featured-collection-image">
          <Image data={image} sizes="(min-width: 768px) 45vw, 100vw" />
        </div>
      )}
      <div className="featured-collection-copy">
        <span>Featured assortment</span>
        <h2>{collection.title}</h2>
      </div>
    </Link>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section className="recommended-products">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Curated picks</span>
          <h2>New arrivals in the tea room</h2>
        </div>
        <Link to="/collections/all">See all teas</Link>
      </div>

      <Suspense fallback={<div className="loading-state">Loading teas...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid">
              {response
                ? response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
    </section>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
