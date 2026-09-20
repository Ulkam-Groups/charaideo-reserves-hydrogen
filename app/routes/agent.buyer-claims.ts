import type {Route} from './+types/agent.buyer-claims';

const noStore = {'Cache-Control': 'private, no-store'};

export async function loader({request, context}: Route.LoaderArgs) {
  const storeDomain = context.env.PUBLIC_STORE_DOMAIN?.trim();
  if (!storeDomain || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(storeDomain)) {
    return new Response('Shopify store domain is unavailable', {
      status: 503,
      headers: noStore,
    });
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `/agent/buyer-claims${requestUrl.search}`,
    `https://${storeDomain}`,
  );
  const headers = new Headers({
    Accept: 'text/html',
    'Sec-Shopify-Storefront-Origin': requestUrl.origin,
  });
  const language = request.headers.get('accept-language');
  if (language) headers.set('Accept-Language', language);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers,
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return new Response('Shopify chat is temporarily unavailable', {
      status: 502,
      headers: noStore,
    });
  }

  const location = upstream.headers.get('location');
  if (location && new URL(location, upstreamUrl).pathname === '/password') {
    return new Response('Shopify Online Store password protection blocks chat', {
      status: 503,
      headers: noStore,
    });
  }

  if (upstream.status === 404) {
    return new Response('Shopify chat is unavailable for this storefront origin', {
      status: 503,
      headers: noStore,
    });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.set('Cache-Control', 'private, no-store');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
