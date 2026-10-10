import type {Route} from './+types/shopify-chat-assets.$';
import {
  ALLOWED_SHOPIFY_CHAT_ASSET,
  rewriteShopifyChatAssetSource,
  SHOPIFY_CHAT_ASSET_ORIGIN,
  SHOPIFY_CHAT_LOCAL_PREFIX,
  SHOPIFY_CHAT_REMOTE_PREFIX,
} from '../lib/shopify-chat-assets.ts';

export async function loader({request, context}: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const assetPath = requestUrl.pathname.slice(SHOPIFY_CHAT_LOCAL_PREFIX.length);

  if (!assetPath || assetPath.includes('..')) {
    return new Response('Invalid Shopify chat asset path', {status: 400});
  }

  if (assetPath === 'claims-bootstrap.js') {
    const buyerStoreDomain = context.env.PUBLIC_STORE_DOMAIN?.trim() ?? '';
    const buyerStoreHandle = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(
      buyerStoreDomain,
    )
      ? buyerStoreDomain.slice(0, -'.myshopify.com'.length)
      : '';

    return new Response(
      `const buyerStoreHandle=${JSON.stringify(buyerStoreHandle)};const meta=document.querySelector('meta[name="shopify-buyer-claims"]');if(meta?.content){window.location.hash=meta.content;meta.remove();}const originalFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const inputWasRequest=input instanceof Request;const url=new URL(inputWasRequest?input.url:String(input),window.location.href);const isAgentApiPath=url.pathname.startsWith('/api/store/')||url.pathname.startsWith('/api/buyer_context/');if(buyerStoreHandle&&url.pathname.startsWith('/api/store/')){url.pathname=url.pathname.replace(/^\\/api\\/store\\/[^/]+\\//,'/api/store/'+buyerStoreHandle+'/');}if(url.origin==='https://storefront-agent-server.shopify.ai'||(url.origin===window.location.origin&&isAgentApiPath)){url.pathname='/shopify-agent-api'+url.pathname;url.protocol=window.location.protocol;url.host=window.location.host;input=inputWasRequest?new Request(url.toString(),input):url.toString();}else if(buyerStoreHandle&&url.origin==='https://messaging-api.shopifyapps.com'&&url.pathname.startsWith('/shopify_chat/api/storefront/storefront_agent/')&&url.searchParams.has('store_handle')){url.searchParams.set('store_handle',buyerStoreHandle);input=inputWasRequest?new Request(url.toString(),input):url.toString();}return originalFetch(input,init);};`,
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/javascript; charset=utf-8',
        },
      },
    );
  }

  if (!ALLOWED_SHOPIFY_CHAT_ASSET.test(assetPath)) {
    return new Response('Unsupported Shopify chat asset', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const upstreamUrl = new URL(
    `${SHOPIFY_CHAT_REMOTE_PREFIX}${assetPath}`,
    SHOPIFY_CHAT_ASSET_ORIGIN,
  );
  let upstream: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      upstream = await fetch(upstreamUrl);
      if (upstream.ok) break;
    } catch {
      // Retry because these modules are required to initialize chat.
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  if (!upstream?.ok) {
    return new Response('Shopify chat asset is temporarily unavailable', {
      status: 502,
    });
  }
  const headers = new Headers();
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('javascript')) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  const source = rewriteShopifyChatAssetSource(
    assetPath,
    await upstream.text(),
  );

  return new Response(source, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
