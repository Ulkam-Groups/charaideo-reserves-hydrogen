import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/tea-academy.journal._index';

export const meta: Route.MetaFunction = ({data}) => [
  {title: `${data?.blog?.title ?? 'Tea Journal'} | Charaideo Reserves™`},
  {name: 'description', content: data?.blog?.seo?.description || 'Stories from tea estates, buyers, makers, and founders.'},
];

export async function loader({context}: Route.LoaderArgs) {
  const {blog} = await context.storefront.query(TEA_JOURNAL_QUERY, {
    variables: {handle: 'tea-journal'},
    cache: context.storefront.CacheShort({maxAge: 300, staleWhileRevalidate: 1800}),
  });
  return {blog};
}

type JournalArticle = {
  id: string;
  title: string;
  handle: string;
  excerpt: string | null;
  publishedAt: string;
  authorV2: {name: string} | null;
  image: {url: string; altText: string | null} | null;
};

export default function TeaJournal() {
  const {blog} = useLoaderData<typeof loader>();
  const articles = (blog?.articles.nodes ?? []) as JournalArticle[];
  return <main className="journal-page">
    <header className="journal-hero"><nav className="listing-breadcrumb" aria-label="Breadcrumb"><Link prefetch="none" to="/">Home</Link><span aria-hidden="true">/</span><Link prefetch="none" to="/tea-academy">Tea Academy</Link><span aria-hidden="true">/</span><span>Tea Journal</span></nav><p className="eyebrow">Field notes and considered voices</p><h1>{blog?.title || 'Tea Journal'}</h1><p>{blog?.seo?.description || 'Stories from tea estates, buyers, founders, and the people shaping the future of Assam tea.'}</p></header>
    {articles.length ? <section className="journal-grid">{articles.map((article, index) => <Link prefetch="none" key={article.id} className={index === 0 ? 'journal-card journal-card-featured' : 'journal-card'} to={`/tea-academy/journal/${article.handle}`}>
      {article.image ? <img src={article.image.url} alt={article.image.altText || article.title} loading={index > 2 ? 'lazy' : 'eager'} /> : <div className="journal-card-placeholder" aria-hidden="true">Charaideo<br />Journal</div>}
      <div><h2>{article.title}</h2><time className="journal-card-date" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time><p className="journal-card-excerpt">{article.excerpt || 'Read the latest story from the world of tea.'}</p><span>Read story</span></div>
    </Link>)}</section> : <section className="journal-empty"><p className="eyebrow">The first edition</p><h2>Stories are steeping.</h2><p>Create a Shopify blog with the handle <code>tea-journal</code>, then publish an article to make it appear here.</p><Link prefetch="none" to="/tea-academy/sensory">Explore Tea Sensory</Link></section>}
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(value));
}

const TEA_JOURNAL_QUERY = `#graphql
  query TeaJournal($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    blog(handle: $handle) {
      id title handle seo { title description }
      articles(first: 24, sortKey: PUBLISHED_AT, reverse: true) {
        nodes { id title handle excerpt publishedAt authorV2 { name } image { url altText width height } }
      }
    }
  }
` as const;
