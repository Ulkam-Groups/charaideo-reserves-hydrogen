import {useState} from 'react';
import {Link, useLoaderData, useSearchParams} from 'react-router';
import type {Route} from './+types/tea-academy._index';
import {TeaSensoryExperience} from '~/components/TeaSensoryExperience';
import {parseSensoryTea, type StorefrontSensoryProduct} from '~/lib/tea-sensory';
import charaideoLogo from '~/assets/charaideo-reserves-logo.svg?url';
import {breadcrumbJsonLd, canonicalUrl} from '~/lib/seo';

const ctcImage = 'https://cdn.shopify.com/s/files/1/0651/6119/9713/files/ctc.jpg?v=1793814820';
const greenImage = 'https://cdn.shopify.com/s/files/1/0651/6119/9713/files/green.jpg?v=1793814789';
const orthodoxImage = 'https://cdn.shopify.com/s/files/1/0651/6119/9713/files/orthodox.jpg?v=1793814823';
const hojichaImage = 'https://cdn.shopify.com/s/files/1/0651/6119/9713/files/hojicha.jpg?v=1793814821';
const matchaImage = 'https://cdn.shopify.com/s/files/1/0651/6119/9713/files/matcha.jpg?v=1793814822';

export const meta: Route.MetaFunction = () => [
  {title: 'Tea Academy | Charaideo Reserves™'},
  {
    name: 'description',
    content:
      'Learn to read a cup and explore Assam tea with Charaideo Reserves, from the House of Tea Reserves of India.',
  },
  {rel: 'canonical', href: canonicalUrl('/tea-academy')},
  {
    'script:ld+json': breadcrumbJsonLd([
      {name: 'Home', path: '/'},
      {name: 'Tea Academy', path: '/tea-academy'},
    ]),
  },
];

type AcademySection = 'sensory' | 'journal';
type AcademyArticle = {
  id: string;
  title: string;
  handle: string;
  excerpt: string | null;
  publishedAt: string;
  authorV2: {name: string} | null;
  image: {url: string; altText: string | null} | null;
};

export async function loader({context}: Route.LoaderArgs) {
  const {products, blog} = await context.storefront.query(TEA_ACADEMY_QUERY, {
    cache: context.storefront.CacheShort({maxAge: 300, staleWhileRevalidate: 1800}),
  });
  return {
    teas: (products.nodes as StorefrontSensoryProduct[])
      .map(parseSensoryTea)
      .filter((tea) => tea !== null),
    journal: blog ? {...blog, articles: blog.articles.nodes as AcademyArticle[]} : null,
  };
}

export default function TeaAcademy() {
  const {teas, journal} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<AcademySection>(
    searchParams.get('section') === 'journal' ? 'journal' : 'sensory',
  );
  const [sensoryMatched, setSensoryMatched] = useState(false);
  const [sensorySession, setSensorySession] = useState(0);

  function selectSection(next: AcademySection) {
    if (next === 'sensory') {
      setSensoryMatched(false);
      setSensorySession((session) => session + 1);
    }
    setSection(next);
    window.requestAnimationFrame(() =>
      document
        .getElementById('academy-content')
        ?.scrollIntoView({behavior: 'smooth', block: 'start'}),
    );
  }
  return (
    <main className="academy-page">
      <header className="academy-hero">
        <div className="academy-atlas-layout">
          <div className="academy-atlas-copy">
            <p className="academy-atlas-eyebrow">Knowledge, ritual, provenance</p>
            <h1>One bud, two leaves.<br />Many forms.</h1>
            <p>How processing changes the leaf’s structure, aroma and cup.</p>
            <div className="academy-atlas-signature" aria-label="Charaideo Reserves Tea Academy">
              <img src={charaideoLogo} alt="" />
              <span><strong>Charaideo Reserves</strong><small>Tea Academy</small></span>
            </div>
          </div>
          <div className="academy-atlas-study">
            <div className="academy-atlas-ruler">
              <p><i>Camellia sinensis</i> var. <i>assamica</i></p>
              <svg viewBox="0 0 600 28" aria-hidden="true">
                <path d="M1 6H599M1 1V18M120 6V18M240 6V18M360 6V18M480 6V18M599 1V18" />
              </svg>
              <div aria-hidden="true"><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50 mm</span></div>
            </div>
            <ol className="academy-atlas-specimens" aria-label="Five forms of processed tea">
              {[
                ['01', 'CTC', 'Crush · Tear · Curl', ctcImage],
                ['02', 'Green', 'Pan-fired', greenImage],
                ['03', 'Orthodox', 'Roller-dried', orthodoxImage],
                ['04', 'Hojicha', 'Roasted', hojichaImage],
                ['05', 'Matcha', 'Stone-ground', matchaImage],
              ].map(([number, name, process, image]) => (
                <li key={name}>
                  <img src={image} alt={`${name} tea leaves`} />
                  <span>{number}</span><strong>{name}</strong><small>{process}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="academy-atlas-border" aria-hidden="true" />
      </header>
      <nav
        className="academy-section-menu"
        aria-label="Tea Academy sections"
        role="tablist"
      >
        <span className="academy-section-menu-label" aria-hidden="true">
          Learn about tea
        </span>
        <button
          aria-controls="academy-content"
          aria-selected={section === 'sensory'}
          className={section === 'sensory' ? 'active' : ''}
          onClick={() => selectSection('sensory')}
          role="tab"
          type="button"
        >
          <strong>Tea Sensory</strong>
        </button>
        <button
          aria-controls="academy-content"
          aria-selected={section === 'journal'}
          className={section === 'journal' ? 'active' : ''}
          onClick={() => selectSection('journal')}
          role="tab"
          type="button"
        >
          <strong>Tea Journal</strong>
        </button>
      </nav>
      <div
        className="academy-inline-content"
        id="academy-content"
        role="tabpanel"
        tabIndex={-1}
      >
        {section === 'sensory' ? (
          <section
            className={`academy-panel${sensoryMatched ? ' sensory-matched' : ''}`}
            key="sensory"
          >
            {!sensoryMatched ? (
              <header className="academy-panel-heading">
                <p className="eyebrow">A guided tasting compass</p>
                <h2>
                  Let the wheel guide <em>your cup.</em>
                </h2>
                <p>
                  There is no wrong answer. Choose what feels inviting and we will find
                  the closest sensory match from the teas currently in our reserve.
                </p>
              </header>
            ) : null}
            <TeaSensoryExperience
              key={sensorySession}
              teas={teas}
              onRevealChange={setSensoryMatched}
            />
          </section>
        ) : (
          <AcademyJournal journal={journal} key="journal" />
        )}
      </div>
      <section className="academy-manifesto">
        <p className="eyebrow">The Charaideo approach</p>
        <blockquote>
          Tea becomes more memorable when we have the language to notice it.
        </blockquote>
        <p>
          The Academy will continue to grow with every harvest, new sensory profile, and
          contributor.
        </p>
      </section>
    </main>
  );
}

function AcademyJournal({
  journal,
}: {
  journal: {title: string; articles: AcademyArticle[]} | null;
}) {
  const articles = journal?.articles ?? [];
  return (
    <section className="academy-panel academy-journal-panel">
      <header className="academy-panel-heading">
        <p className="eyebrow">Field notes and considered voices</p>
        <h2>{journal?.title || 'Tea Journal'}</h2>
        <p>
          Stories from tea estates, buyers, founders, and the people shaping the future of
          Assam tea.
        </p>
      </header>
      {articles.length ? (
        <div className="journal-grid">
          {articles.map((article, index) => (
            <Link
              prefetch="none"
              key={article.id}
              className={
                index === 0 ? 'journal-card journal-card-featured' : 'journal-card'
              }
              to={`/tea-academy/journal/${article.handle}`}
            >
              {article.image ? (
                <img
                  src={article.image.url}
                  alt={article.image.altText || article.title}
                  loading={index > 2 ? 'lazy' : 'eager'}
                />
              ) : (
                <div className="journal-card-placeholder" aria-hidden="true">
                  Charaideo
                  <br />
                  Journal
                </div>
              )}
              <div>
                <h3>{article.title}</h3>
                <time className="journal-card-date" dateTime={article.publishedAt}>
                  {formatDate(article.publishedAt)}
                </time>
                <p className="journal-card-excerpt">
                  {article.excerpt || 'Read the latest story from the world of tea.'}
                </p>
                <span>Read story</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="journal-empty">
          <p className="eyebrow">The first edition</p>
          <h3>Stories are steeping.</h3>
          <p>
            Create a Shopify blog with the handle <code>tea-journal</code>, then publish
            an article to make it appear here.
          </p>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

const TEA_ACADEMY_QUERY = `#graphql
  query TeaAcademy($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    products(first: 100, sortKey: TITLE) { nodes { id title handle productType vendor availableForSale image: featuredImage { url altText width height } priceRange { minVariantPrice { amount currencyCode } } sensoryProfile: metafield(namespace: "custom", key: "tea_sensory_profile") { type value } } }
    blog(handle: "tea-journal") { id title articles(first: 24, sortKey: PUBLISHED_AT, reverse: true) { nodes { id title handle excerpt publishedAt authorV2 { name } image { url altText width height } } } }
  }
` as const;
