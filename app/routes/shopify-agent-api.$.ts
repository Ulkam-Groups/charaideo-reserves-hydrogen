import type {Route} from './+types/shopify-agent-api.$';

const AGENT_ORIGIN = 'https://storefront-agent-server.shopify.ai';
const LOCAL_PREFIX = '/shopify-agent-api';

export function loader(args: Route.LoaderArgs) {
  return proxyAgentRequest(args.request);
}

export function action(args: Route.ActionArgs) {
  return proxyAgentRequest(args.request);
}

async function proxyAgentRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `${requestUrl.pathname.slice(LOCAL_PREFIX.length)}${requestUrl.search}`,
    AGENT_ORIGIN,
  );
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('origin', AGENT_ORIGIN);
  headers.set('referer', `${AGENT_ORIGIN}/`);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return new Response('Shopify agent API is temporarily unavailable', {
      status: 502,
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
