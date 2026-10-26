import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/tea-academy.sensory';
import {TeaSensoryExperience} from '~/components/TeaSensoryExperience';
import {parseSensoryTea, type StorefrontSensoryProduct} from '~/lib/tea-sensory';
import {breadcrumbJsonLd, canonicalUrl} from '~/lib/seo';

export const meta: Route.MetaFunction = () => [
  {title: 'Tea Sensory | Tea Academy | Charaideo Reserves™'},
  {
    name: 'description',
    content:
      'Find your Charaideo Reserves Assam tea by flavour, body and ritual. From the House of Tea Reserves of India.',
  },
  {rel: 'canonical', href: canonicalUrl('/tea-academy/sensory')},
  {
    'script:ld+json': breadcrumbJsonLd([
      {name: 'Home', path: '/'},
      {name: 'Tea Academy', path: '/tea-academy'},
      {name: 'Tea Sensory', path: '/tea-academy/sensory'},
    ]),
  },
];

export async function loader({context}: Route.LoaderArgs) {
  const {products} = await context.storefront.query(TEA_SENSORY_PRODUCTS_QUERY, {
    cache: context.storefront.CacheShort({maxAge: 300, staleWhileRevalidate: 1800}),
  });
  return {
    teas: (products.nodes as StorefrontSensoryProduct[])
      .map(parseSensoryTea)
      .filter((tea) => tea !== null),
  };
}

export default function TeaSensoryPage() {
  const {teas} = useLoaderData<typeof loader>();
  return (
    <main className="sensory-page">
      <header className="sensory-hero">
        <div>
          <nav className="listing-breadcrumb" aria-label="Breadcrumb">
            <Link prefetch="none" to="/">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link prefetch="none" to="/tea-academy">
              Tea Academy
            </Link>
            <span aria-hidden="true">/</span>
            <span>Tea Sensory</span>
          </nav>
          <p className="eyebrow">A guided tasting compass</p>
          <h1>
            Let the wheel guide <em>your cup.</em>
          </h1>
          <p>
            There is no wrong answer. Choose what feels inviting and we will find the
            closest sensory match from the teas currently in our reserve.
          </p>
        </div>
      </header>
      <TeaSensoryExperience teas={teas} />
      <section className="sensory-method">
        <p className="eyebrow">How matching works</p>
        <div>
          <article>
            <span>01</span>
            <h2>Notice</h2>
            <p>Begin with the mood and flavour you want from this moment.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Compare</h2>
            <p>
              Your choices are compared with tasting profiles maintained on each Shopify
              product.
            </p>
          </article>
          <article>
            <span>03</span>
            <h2>Brew</h2>
            <p>Receive the closest matches and a product-specific starting ritual.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

const TEA_SENSORY_PRODUCTS_QUERY = `#graphql
  query TeaSensoryProducts($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 100, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        productType
        vendor
        availableForSale
        image: featuredImage { url altText width height }
        priceRange { minVariantPrice { amount currencyCode } }
        sensoryProfile: metafield(namespace: "custom", key: "tea_sensory_profile") { type value }
      }
    }
  }
` as const;
