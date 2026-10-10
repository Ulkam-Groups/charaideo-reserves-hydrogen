export const SHOPIFY_CHAT_ASSET_ORIGIN = 'https://cdn.shopify.com';
export const SHOPIFY_CHAT_REMOTE_PREFIX = '/storefront/web-components/';
export const SHOPIFY_CHAT_LOCAL_PREFIX = '/shopify-chat-assets/';

export const ALLOWED_SHOPIFY_CHAT_ASSET =
  /^(?:chat\.js|agent-iframe\.js|(?:chat|agent-iframe)\/[A-Za-z0-9_-]{6,120}\.js)$/;

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
