import type {Route} from './+types/shopify-chat-assets.$';
import {
  ALLOWED_SHOPIFY_CHAT_ASSET,
  createShopifyClaimsBootstrap,
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
    return new Response(
      createShopifyClaimsBootstrap(context.env.PUBLIC_STORE_DOMAIN),
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
