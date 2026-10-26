import type {Route} from './+types/sitemap.$type.$page[.xml]';
import {getSitemap} from '@shopify/hydrogen';

export async function loader({
  request,
  params,
  context: {storefront},
}: Route.LoaderArgs) {
  if (params.type === 'static') {
    return staticSitemap(request, storefront);
  }

  const response = await getSitemap({
    storefront,
    request,
    params,
    getLink: ({type, baseUrl, handle}) => `${baseUrl}/${type}/${handle}`,
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}

const STATIC_PATHS = [
  '/',
  '/reserve-list',
  '/tea-academy',
  '/tea-academy/journal',
  '/tea-academy/sensory',
] as const;

async function staticSitemap(
  request: Request,
  storefront: Route.LoaderArgs['context']['storefront'],
) {
  const baseUrl = new URL(request.url).origin;
  const {blog} = await storefront.query(TEA_JOURNAL_SITEMAP_QUERY, {
    variables: {handle: 'tea-journal'},
    cache: storefront.CacheLong(),
  });
  const journalPaths = (blog?.articles.nodes ?? []).map(
    (article: {handle: string}) => `/tea-academy/journal/${article.handle}`,
  );
  const urls = [...STATIC_PATHS, ...journalPaths]
    .map(
      (path) =>
        `  <url><loc>${baseUrl}${path}</loc><changefreq>weekly</changefreq></url>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

const TEA_JOURNAL_SITEMAP_QUERY = `#graphql
  query TeaJournalSitemap($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    blog(handle: $handle) {
      articles(first: 250, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          handle
        }
      }
    }
  }
` as const;
