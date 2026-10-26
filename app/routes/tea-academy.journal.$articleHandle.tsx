import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/tea-academy.journal.$articleHandle';
import {sanitizeStorefrontHtml} from '~/lib/html.server';
import {
  brandedMetaDescription,
  breadcrumbJsonLd,
  canonicalUrl,
} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data, params}) => {
  const article = data?.article;
  const handle = params.articleHandle ?? '';
  const articleUrl = canonicalUrl(`/tea-academy/journal/${handle}`);
  const description = brandedMetaDescription(
    article?.seo?.description || article?.excerpt,
    'Read the latest story from the Charaideo Reserves Tea Journal.',
  );

  return [
    {title: `${article?.seo?.title || article?.title || 'Tea Journal'} | Charaideo Reserves™`},
    {name: 'description', content: description},
    {rel: 'canonical', href: articleUrl},
    ...(article
      ? [{
          'script:ld+json': [
            {
              '@context': 'https://schema.org',
              '@type': 'Article',
              '@id': `${articleUrl}#article`,
              headline: article.title,
              description,
              datePublished: article.publishedAt,
              mainEntityOfPage: articleUrl,
              image: article.image?.url,
              author: article.authorV2?.name
                ? {'@type': 'Person', name: article.authorV2.name}
                : {'@type': 'Organization', name: 'Charaideo Reserves'},
              publisher: {'@id': 'https://www.teareserves.com/#organization'},
            },
            breadcrumbJsonLd([
              {name: 'Home', path: '/'},
              {name: 'Tea Academy', path: '/tea-academy'},
              {name: 'Tea Journal', path: '/tea-academy/journal'},
              {name: article.title, path: `/tea-academy/journal/${handle}`},
            ]),
          ],
        }]
      : []),
  ];
};

export async function loader({params, context}: Route.LoaderArgs) {
  const {blog} = await context.storefront.query(TEA_JOURNAL_ARTICLE_QUERY, {
    variables: {blogHandle: 'tea-journal', articleHandle: params.articleHandle},
    cache: context.storefront.CacheShort({maxAge: 300, staleWhileRevalidate: 1800}),
  });
  if (!blog?.articleByHandle) throw new Response('Journal article not found', {status: 404});
  return {article: {...blog.articleByHandle, contentHtml: sanitizeStorefrontHtml(blog.articleByHandle.contentHtml)}};
}

export default function TeaJournalArticle() {
  const {article} = useLoaderData<typeof loader>();
  return <main className="journal-article-page"><header className="journal-article-hero"><Link prefetch="none" className="journal-back-button" to="/tea-academy?section=journal#academy-content" aria-label="Back to Tea Journal"><span aria-hidden="true" /> Tea Journal</Link><div className="journal-article-title-block"><h1>{article.title}</h1><time className="journal-article-date" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time></div>{article.excerpt ? <p>{article.excerpt}</p> : null}</header>{article.image ? <figure className="journal-article-image"><img src={article.image.url} alt={article.image.altText || article.title} /><figcaption>{article.image.altText}</figcaption></figure> : null}<article className="journal-article-body" dangerouslySetInnerHTML={{__html: article.contentHtml}} /><footer className="journal-article-footer"><Link prefetch="none" to="/tea-academy?section=journal#academy-content">Back to Tea Journal</Link></footer></main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(value));
}

const TEA_JOURNAL_ARTICLE_QUERY = `#graphql
  query TeaJournalArticle($blogHandle: String!, $articleHandle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    blog(handle: $blogHandle) {
      articleByHandle(handle: $articleHandle) {
        id title handle excerpt contentHtml publishedAt authorV2 { name }
        image { url altText width height }
        seo { title description }
      }
    }
  }
` as const;
