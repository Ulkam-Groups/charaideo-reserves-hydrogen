import type {Route} from './+types/shopify-chat-assets.$';

const CHAT_ASSET_ORIGIN = 'https://cdn.shopify.com';
const CHAT_ASSET_PREFIX = '/storefront/web-components/';
const LOCAL_CHAT_ASSET_PREFIX = '/shopify-chat-assets/';

export async function loader({request}: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const assetPath = requestUrl.pathname.slice(LOCAL_CHAT_ASSET_PREFIX.length);

  if (!assetPath || assetPath.includes('..')) {
    return new Response('Invalid Shopify chat asset path', {status: 400});
  }

  if (assetPath === 'claims-bootstrap.js') {
    return new Response(
      `const meta=document.querySelector('meta[name="shopify-buyer-claims"]');if(meta?.content){window.location.hash=meta.content;meta.remove();}const originalFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),window.location.href);if(url.origin==='https://storefront-agent-server.shopify.ai'){url.pathname='/shopify-agent-api'+url.pathname;url.protocol=window.location.protocol;url.host=window.location.host;input=input instanceof Request?new Request(url.toString(),input):url.toString();}return originalFetch(input,init);};`,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/javascript; charset=utf-8',
        },
      },
    );
  }

  const upstreamUrl = new URL(
    `${CHAT_ASSET_PREFIX}${assetPath}`,
    CHAT_ASSET_ORIGIN,
  );
  let upstream: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      upstream = await fetch(upstreamUrl);
      if (upstream.ok) break;
    } catch {
      // Retry because these modules are required to initialize chat.
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 150 * (attempt + 1)),
    );
  }
  if (!upstream?.ok) {
    return new Response('Shopify chat asset is temporarily unavailable', {
      status: 502,
    });
  }
  const headers = new Headers(upstream.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.set('Cache-Control', 'public, max-age=300');

  const contentType = headers.get('content-type') ?? '';
  if (!contentType.includes('javascript')) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  let source = await upstream.text();
  if (assetPath === 'chat.js') {
    source = source.replace(
      /(["'])\.\/chat\/((?:shopify-chat-telemetry|host-monorail)-[^"']+\.js)\1/g,
      (_match, quote: string, file: string) =>
        `${quote}${CHAT_ASSET_ORIGIN}${CHAT_ASSET_PREFIX}chat/${file}${quote}`,
    );
  }
  if (/\/agent-runtime-[\w-]+\.js$/.test(requestUrl.pathname)) {
    source = source.replace(
      /function qt\(e\s*=\s*window\.location\.href\)\s*\{[\s\S]*?\}\s*function Ut/,
      `function qt() {\n  return window.location.origin;\n}\nfunction Ut`,
    );
    source = source.replace(
      /(["'])\.\/([^"']+\.js)\1/g,
      (_match, quote: string, file: string) =>
        `${quote}${CHAT_ASSET_ORIGIN}${CHAT_ASSET_PREFIX}chat/${file}${quote}`,
    );
    source = source.replace(
      /(["'])\.\.\/chat\.js\1/g,
      (_match, quote: string) =>
        `${quote}${LOCAL_CHAT_ASSET_PREFIX}chat.js${quote}`,
    );
  }

  return new Response(source, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
