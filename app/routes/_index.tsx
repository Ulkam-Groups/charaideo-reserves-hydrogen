import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';
import riverThreadMap from '../../river-thread-web/svg/about-map-route.svg?url';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = () => [
  {title: 'Charaideo Reserves | Assam tea, remembered'},
  {name: 'description', content: "Explore the Reserve List of Assam's fine tea estates. Single-estate, single-harvest teas sourced directly from historic gardens in Assam."},
];

export async function loader(args: Route.LoaderArgs) {
  return {...loadDeferredData(args), ...(await loadCriticalData(args))};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  return {isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN)};
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront.query(RECOMMENDED_PRODUCTS_QUERY).catch(() => {
    console.error('Recommended products query failed.');
    return null;
  });
  return {recommendedProducts};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home-page">
      {!data.isShopLinked && <MockShopNotice />}
      <section className="tea-room-hero">
        <div className="tea-room-copy">
          <span className="eyebrow">26.98° N / Assam, North East India</span>
          <h1>The Reserve List of Assam&apos;s <em>Fine Tea Estates.</em></h1>
          <p>Single-estate, single-harvest teas — sourced directly from historic gardens in Assam and reserved in order, Chapter by Chapter. Once a garden enters our list, it stays.</p>
          <div className="hero-actions">
            <Link className="button primary" to="/collections/all">Explore the Reserves <span aria-hidden="true">↗</span></Link>
            <Link className="quiet-link" to="/pages/about-us">Read our story</Link>
          </div>
          <div className="hero-footnote"><span className="tiny-diamond" aria-hidden="true">◇</span> From our home, to your table.</div>
        </div>
        <figure className="tea-room-image" aria-label="The River Thread, Charaideo Reserves' mark of place">
          <div className="hero-plate">
            <span className="hero-cha" aria-hidden="true">চ</span>
            <span className="hero-cup" aria-hidden="true"><i /></span>
            <p>A river thread.<br />A tea-liquor seed.<br />A letter from Assam.</p>
          </div>
          <img className="hero-map-letter" src={riverThreadMap} width="1600" height="600" alt="" />
          <figcaption><span>THE RIVER THREAD / 01</span><span>CHARAIDEO, ASSAM</span></figcaption>
        </figure>
      </section>

      <div className="origin-strip"><span>ROOTED IN ASSAM</span><span aria-hidden="true">◇</span><span>RESERVED WITH PURPOSE</span><span aria-hidden="true">◇</span><span>SHARED WITH THE WORLD</span></div>

      <section className="tea-selection">
        <div className="editorial-heading">
          <div><span className="eyebrow">Most poured / best sellers</span><h2>The Reserves people return to.</h2><p>Each pouch is one estate, one harvest, fully traceable. No blends.</p></div>
          <Link className="text-link" to="/collections/all">Explore all teas ↗</Link>
        </div>
        <Suspense fallback={<p className="loading-state">Opening the tea cabinet…</p>}>
          <Await resolve={data.recommendedProducts}>
            {(response: RecommendedProductsQuery | null) => response?.products.nodes.length ? (
              <div className="recommended-products-grid">{response.products.nodes.map((product) => <ProductItem key={product.id} product={product} showVariants />)}</div>
            ) : <p>Our tea cabinet is being refreshed. <Link to="/collections/all">Explore the catalog →</Link></p>}
          </Await>
        </Suspense>
      </section>

      <section className="heritage-note">
        <span className="eyebrow">More than a place of origin</span>
        <div><h2>We keep the estate name <em>on the pouch.</em></h2><p>Assam&apos;s finest teas lose their name before they reach you — blended into &quot;Premium Assam Tea&quot;. We do the opposite. We source directly from one historic garden at a time, document its harvest, and release it as a permanent Chapter. For the drinker — you know the garden, the flush, the grade. For the garden — it finally gets its name and premium.</p><Link className="text-link" to="/pages/about-us">The story of Charaideo ↗</Link></div>
        <span className="heritage-seal" aria-hidden="true">চ<span>ASSAM</span>26.98°</span>
      </section>

      <section className="ritual-section"><span className="eyebrow">The art of taking a moment</span><h2>Nothing to hurry.<br /><em>Something to savour.</em></h2><div className="ritual-grid">{[
        ['01','Choose with care','A bold morning black or a light afternoon green. Begin with the estate and harvest, not just flavour.'],
        ['02','Give it time','Fresh water. Your favourite cup. Whole leaves need time to open — 3g, 85°C, 3 mins. Tasting notes on every pouch.'],
        ['03','Make room','For one more cup. For conversation. Every pouch is traceable to its garden with QR — estate, pluck date, and brew guide.'],
      ].map(([number,title,copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    </div>
  );
}

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id title handle productType description
    tastingNotes: metafield(namespace: "custom", key: "tasting_notes") { value }
    selectedOrFirstAvailableVariant { id availableForSale }
    priceRange { minVariantPrice { amount currencyCode } }
    featuredImage { id url altText width height }
    variants(first: 20) {
      nodes {
        id
        title
        availableForSale
        price { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: BEST_SELLING) { nodes { ...RecommendedProduct } }
  }
` as const;
