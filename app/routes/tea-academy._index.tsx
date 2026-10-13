import {useState} from 'react';
import {Link, useLoaderData, useSearchParams} from 'react-router';
import type {Route} from './+types/tea-academy._index';
import {TeaSensoryExperience} from '~/components/TeaSensoryExperience';
import {parseSensoryTea, type StorefrontSensoryProduct} from '~/lib/tea-sensory';

export const meta: Route.MetaFunction = () => [
  {title: 'Tea Academy | Charaideo Reserves™'},
  {name: 'description', content: 'Learn to read a cup, find tea by sensory character, and discover stories from the people behind Assam tea.'},
];

type AcademySection = 'sensory' | 'journal';
type AcademyArticle = {id: string; title: string; handle: string; excerpt: string | null; publishedAt: string; authorV2: {name: string} | null; image: {url: string; altText: string | null} | null};

export async function loader({context}: Route.LoaderArgs) {
  const {products, blog} = await context.storefront.query(TEA_ACADEMY_QUERY, {cache: context.storefront.CacheShort({maxAge: 300, staleWhileRevalidate: 1800})});
  return {teas: (products.nodes as StorefrontSensoryProduct[]).map(parseSensoryTea).filter((tea) => tea !== null), journal: blog ? {...blog, articles: blog.articles.nodes as AcademyArticle[]} : null};
}

export default function TeaAcademy() {
  const {teas, journal} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<AcademySection>(searchParams.get('section') === 'journal' ? 'journal' : 'sensory');
  const [sensoryMatched, setSensoryMatched] = useState(false);
  const [sensorySession, setSensorySession] = useState(0);
  function selectSection(next: AcademySection) {
    if (next === 'sensory') {
      setSensoryMatched(false);
      setSensorySession((session) => session + 1);
    }
    setSection(next);
    window.requestAnimationFrame(() => document.getElementById('academy-content')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
  }
  return <main className="academy-page">
    <header className="academy-hero">
      <div><p className="eyebrow">Knowledge, ritual, provenance</p><h1>Learn tea through <em>the senses.</em></h1><p>Follow flavour, feeling, and the voices of the people who know each leaf. Tea Academy is a living guide to understanding what is in your cup.</p></div>
      <div className="academy-hero-mark">
        <svg aria-label="Charaideo Reserves Tea Academy" role="img" viewBox="0 0 240 240">
          <defs>
            <path d="M 44 120 A 76 76 0 0 1 196 120" id="academy-stamp-top" />
            <path d="M 44 128 A 76 76 0 0 0 196 128" id="academy-stamp-bottom" />
          </defs>
          <circle cx="120" cy="120" r="105" />
          <circle cx="120" cy="120" r="91" />
          <text className="academy-stamp-copy"><textPath href="#academy-stamp-top" startOffset="50%" textAnchor="middle">CHARAIDEO RESERVES™</textPath></text>
          <text className="academy-stamp-copy"><textPath href="#academy-stamp-bottom" startOffset="50%" textAnchor="middle">TEA ACADEMY</textPath></text>
          <text className="academy-stamp-kanji" x="120" y="143">學</text>
        </svg>
      </div>
    </header>
    <nav className="academy-section-menu" aria-label="Tea Academy sections" role="tablist">
      <button aria-controls="academy-content" aria-selected={section === 'sensory'} className={section === 'sensory' ? 'active' : ''} onClick={() => selectSection('sensory')} role="tab" type="button"><span>01</span><strong>Tea Sensory</strong><small>Find your tea through flavour</small></button>
      <button aria-controls="academy-content" aria-selected={section === 'journal'} className={section === 'journal' ? 'active' : ''} onClick={() => selectSection('journal')} role="tab" type="button"><span>02</span><strong>Tea Journal</strong><small>Stories from origin</small></button>
    </nav>
    <div className="academy-inline-content" id="academy-content" role="tabpanel" tabIndex={-1}>
      {section === 'sensory' ? <section className={`academy-panel${sensoryMatched ? ' sensory-matched' : ''}`} key="sensory">{!sensoryMatched ? <header className="academy-panel-heading"><p className="eyebrow">A guided tasting compass</p><h2>Let the wheel guide <em>your cup.</em></h2><p>There is no wrong answer. Choose what feels inviting and we will find the closest sensory match from the teas currently in our reserve.</p></header> : null}<TeaSensoryExperience key={sensorySession} teas={teas} onRevealChange={setSensoryMatched} /></section> : <AcademyJournal journal={journal} key="journal" />}
    </div>
    <section className="academy-manifesto"><p className="eyebrow">The Charaideo approach</p><blockquote>Tea becomes more memorable when we have the language to notice it.</blockquote><p>The Academy will continue to grow with every harvest, new sensory profile, and contributor.</p></section>
  </main>;
}

function AcademyJournal({journal}: {journal: {title: string; articles: AcademyArticle[]} | null}) {
  const articles = journal?.articles ?? [];
  return <section className="academy-panel academy-journal-panel"><header className="academy-panel-heading"><p className="eyebrow">Field notes and considered voices</p><h2>{journal?.title || 'Tea Journal'}</h2><p>Stories from tea estates, buyers, founders, and the people shaping the future of Assam tea.</p></header>{articles.length ? <div className="journal-grid">{articles.map((article, index) => <Link key={article.id} className={index === 0 ? 'journal-card journal-card-featured' : 'journal-card'} to={`/tea-academy/journal/${article.handle}`}>{article.image ? <img src={article.image.url} alt={article.image.altText || article.title} loading={index > 2 ? 'lazy' : 'eager'} /> : <div className="journal-card-placeholder" aria-hidden="true">Charaideo<br />Journal</div>}<div><h3>{article.title}</h3><time className="journal-card-date" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time><p className="journal-card-excerpt">{article.excerpt || 'Read the latest story from the world of tea.'}</p><span>Read story →</span></div></Link>)}</div> : <div className="journal-empty"><p className="eyebrow">The first edition</p><h3>Stories are steeping.</h3><p>Create a Shopify blog with the handle <code>tea-journal</code>, then publish an article to make it appear here.</p></div>}</section>;
}

function formatDate(value: string) {return new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(value));}

const TEA_ACADEMY_QUERY = `#graphql
  query TeaAcademy($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    products(first: 100, sortKey: TITLE) { nodes { id title handle productType vendor availableForSale image: featuredImage { url altText width height } priceRange { minVariantPrice { amount currencyCode } } sensoryProfile: metafield(namespace: "custom", key: "tea_sensory_profile") { type value } } }
    blog(handle: "tea-journal") { id title articles(first: 24, sortKey: PUBLISHED_AT, reverse: true) { nodes { id title handle excerpt publishedAt authorV2 { name } image { url altText width height } } } }
  }
` as const;
