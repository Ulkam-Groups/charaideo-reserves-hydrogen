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
  const headers = new Headers();
  for (const name of [
    'accept',
    'accept-language',
    'origin',
    'referer',
    'user-agent',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('accept')) headers.set('Accept', 'text/html');
  headers.set('Sec-Shopify-Storefront-Origin', requestUrl.origin);

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
