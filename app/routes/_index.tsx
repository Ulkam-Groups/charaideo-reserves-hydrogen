import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import type {
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Charaideo Reserves | A little Assam in your cup'},
    {
      name: 'description',
      content:
        'Shop Assam-origin black tea, CTC, orthodox grades, spiced tea, and signature blends from Charaideo Reserve.',
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
async function loadCriticalData({context}: Route.LoaderArgs) {
  return {isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN)};
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
    <div className="home-page">
      {!data.isShopLinked && <MockShopNotice />}
      <section className="tea-room-hero">
        <div className="tea-room-copy">
          <span className="eyebrow">Assam, North East India &middot; Charaideo Reserves</span>
          <h1>A little Assam.<br />A world within<br /><em>your cup.</em></h1>
          <p>Tea with a sense of place. Rooted in the gardens, culture, and generous spirit of Assam. Made for the moments we share.</p>
          <Link className="button primary" to="/collections/all">Find your tea <span aria-hidden="true">&#8599;</span></Link>
          <div className="hero-footnote"><span className="tiny-diamond" aria-hidden="true">&#9671;</span> From our home, to your table.</div>
        </div>
        <figure className="tea-room-image">
          <img src="https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=85" width="1000" height="1200" fetchPriority="high" alt="A warm cup of tea, a moment to slow down" />
          <figcaption><span>THE EVERYDAY, MADE MEANINGFUL</span><span>01 / THE TEA ROOM</span></figcaption>
        </figure>
      </section>
      <div className="origin-strip"><span>ROOTED IN ASSAM</span><span aria-hidden="true">&#9671;</span><span>POURED WITH PURPOSE</span><span aria-hidden="true">&#9671;</span><span>SHARED WITH THE WORLD</span></div>
      <section className="tea-selection">
        <div className="editorial-heading"><div><span className="eyebrow">The tea cabinet</span><h2>Find your daily ritual.</h2></div><Link className="text-link" to="/collections/all">Explore all teas &#8599;</Link></div>
        <Suspense fallback={<p className="loading-state">Opening the tea cabinet&hellip;</p>}>
          <Await resolve={data.recommendedProducts}>{(response) => response?.products.nodes.length ? <div className="recommended-products-grid">{response.products.nodes.map((product) => <ProductItem key={product.id} product={product} />)}</div> : <p>Our tea cabinet is being refreshed. <Link to="/collections/all">Explore the catalog &#8594;</Link></p>}</Await>
        </Suspense>
      </section>
      <section className="heritage-note"><span className="eyebrow">More than a place of origin</span><div><h2>We bring tea to the world.<br /><em>And heritage back to the table.</em></h2><p>Our name carries the cultural memory of Charaideo and the Ahom legacy. Our spirit belongs to Assam: its tea gardens, its living traditions, and its instinct to make room for one more.</p><Link className="text-link" to="/pages/about-us">The story of Charaideo &#8599;</Link></div><span className="heritage-seal" aria-hidden="true">C<span>ASSAM</span>R</span></section>
      <section className="ritual-section"><span className="eyebrow">The art of taking a moment</span><h2>Nothing to hurry.<br />Something to savour.</h2><div className="ritual-grid">{[['01','Choose with care','A bold morning cup or a gentler afternoon. Begin with what feels right.'],['02','Give it time','Fresh water. Your favourite cup. A few quiet minutes for the leaves to open.'],['03','Make room','For conversation, for company, or simply for yourself.']].map(([number,title,copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    </div>
  );
}

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    productType
    tastingNotes: metafield(namespace: "custom", key: "tasting_notes") { value }
    selectedOrFirstAvailableVariant { id availableForSale }
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
