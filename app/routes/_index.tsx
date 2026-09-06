import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';
import riverThreadMap from '../../river-thread-web/svg/about-map-route.svg?url';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = () => [
  {title: 'Charaideo Reserves | Assam tea, remembered'},
  {name: 'description', content: 'Enter a modern Assamese tea room. Shop Assam-origin teas shaped by garden, ritual, hospitality, and cultural memory.'},
];

export async function loader(args: Route.LoaderArgs) {
  return {...loadDeferredData(args), ...(await loadCriticalData(args))};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  return {isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN)};
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront.query(RECOMMENDED_PRODUCTS_QUERY).catch((error: Error) => {
    console.error(error);
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
          <h1>Tea remembers<br />where it<br /><em>comes from.</em></h1>
          <p>Charaideo Reserves is a modern tea room shaped by Assam-its gardens, its Ahom memory, and the instinct to make room for one more cup.</p>
          <div className="hero-actions">
            <Link className="button primary" to="/collections/all">Enter the tea room <span aria-hidden="true">↗</span></Link>
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

      <div className="origin-strip"><span>ROOTED IN ASSAM</span><span aria-hidden="true">◇</span><span>POURED WITH PURPOSE</span><span aria-hidden="true">◇</span><span>SHARED WITH THE WORLD</span></div>

      <section className="tea-selection">
        <div className="editorial-heading">
          <div><span className="eyebrow">The tea cabinet</span><h2>Find your daily ritual.</h2></div>
          <Link className="text-link" to="/collections/all">Explore all teas ↗</Link>
        </div>
        <Suspense fallback={<p className="loading-state">Opening the tea cabinet…</p>}>
          <Await resolve={data.recommendedProducts}>
            {(response: RecommendedProductsQuery | null) => response?.products.nodes.length ? (
              <div className="recommended-products-grid">{response.products.nodes.map((product) => <ProductItem key={product.id} product={product} />)}</div>
            ) : <p>Our tea cabinet is being refreshed. <Link to="/collections/all">Explore the catalog →</Link></p>}
          </Await>
        </Suspense>
      </section>

      <section className="heritage-note">
        <span className="eyebrow">More than a place of origin</span>
        <div><h2>We bring tea to the world.<br /><em>And heritage back to the table.</em></h2><p>Our name carries the cultural memory of Charaideo and the Ahom legacy. Our spirit belongs to Assam: its tea gardens, its living traditions, and its instinct to make room for one more.</p><Link className="text-link" to="/pages/about-us">The story of Charaideo ↗</Link></div>
        <span className="heritage-seal" aria-hidden="true">চ<span>ASSAM</span>26.98°</span>
      </section>

      <section className="ritual-section"><span className="eyebrow">The art of taking a moment</span><h2>Nothing to hurry.<br /><em>Something to savour.</em></h2><div className="ritual-grid">{[
        ['01','Choose with care','A bold morning cup or a gentler afternoon. Begin with what feels right.'],
        ['02','Give it time','Fresh water. Your favourite cup. A few quiet minutes for the leaves to open.'],
        ['03','Make room','For conversation, for company, or simply for yourself.'],
      ].map(([number,title,copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    </div>
  );
}

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id title handle productType
    tastingNotes: metafield(namespace: "custom", key: "tasting_notes") { value }
    selectedOrFirstAvailableVariant { id availableForSale }
    priceRange { minVariantPrice { amount currencyCode } }
    featuredImage { id url altText width height }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) { nodes { ...RecommendedProduct } }
  }
` as const;
