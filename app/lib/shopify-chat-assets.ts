export const SHOPIFY_CHAT_ASSET_ORIGIN = 'https://cdn.shopify.com';
export const SHOPIFY_CHAT_REMOTE_PREFIX = '/storefront/web-components/';
export const SHOPIFY_CHAT_LOCAL_PREFIX = '/shopify-chat-assets/';

export const ALLOWED_SHOPIFY_CHAT_ASSET =
  /^(?:chat\.js|agent-iframe\.js|(?:chat|agent-iframe)\/[A-Za-z0-9_-]{6,120}\.js)$/;

export function createShopifyClaimsBootstrap(storeDomain: string | undefined) {
  const domain = storeDomain?.trim() ?? '';
  const buyerStoreHandle = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)
    ? domain.slice(0, -'.myshopify.com'.length)
    : '';

  return `const buyerStoreHandle=${JSON.stringify(buyerStoreHandle)};const meta=document.querySelector('meta[name="shopify-buyer-claims"]');if(meta?.content){window.location.hash=meta.content;meta.remove();}const originalFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const inputWasRequest=input instanceof Request;const url=new URL(inputWasRequest?input.url:String(input),window.location.href);const isAgentApiPath=url.pathname.startsWith('/api/store/')||url.pathname.startsWith('/api/buyer_context/');if(buyerStoreHandle&&url.pathname.startsWith('/api/store/')){url.pathname=url.pathname.replace(/^\\/api\\/store\\/[^/]+\\//,'/api/store/'+buyerStoreHandle+'/');}if(url.origin==='https://storefront-agent-server.shopify.ai'||(url.origin===window.location.origin&&isAgentApiPath)){url.pathname='/shopify-agent-api'+url.pathname;url.protocol=window.location.protocol;url.host=window.location.host;input=inputWasRequest?new Request(url.toString(),input):url.toString();}else if(buyerStoreHandle&&url.origin==='https://messaging-api.shopifyapps.com'&&url.pathname.startsWith('/shopify_chat/api/storefront/storefront_agent/')&&url.searchParams.has('store_handle')){url.searchParams.set('store_handle',buyerStoreHandle);input=inputWasRequest?new Request(url.toString(),input):url.toString();}return originalFetch(input,init);};`;
}

export function rewriteShopifyChatAssetSource(
  assetPath: string,
  source: string,
) {
  if (assetPath === 'chat.js') {
    source = source.replace(
      /(["'])\.\/chat\/((?:shopify-chat-telemetry|host-monorail)-[^"']+\.js)\1/g,
      (_match, quote: string, file: string) =>
        `${quote}${SHOPIFY_CHAT_LOCAL_PREFIX}chat/${file}${quote}`,
    );
  }

  if (assetPath.startsWith('chat/')) {
    if (/^chat\/agent-runtime-[\w-]+\.js$/.test(assetPath)) {
      source = source.replace(
        /iframeShellOrigin:[A-Za-z_$][\w$]*\(\)/,
        'iframeShellOrigin:window.location.origin',
      );
    }
    source = source
      .replace(
        /(["'])\.\/([^"']+\.js)\1/g,
        (_match, quote: string, file: string) =>
          `${quote}${SHOPIFY_CHAT_LOCAL_PREFIX}chat/${file}${quote}`,
      )
      .replace(
        /(["'])\.\.\/chat\.js\1/g,
        (_match, quote: string) =>
          `${quote}${SHOPIFY_CHAT_LOCAL_PREFIX}chat.js${quote}`,
      );
  }

  return source;
}
