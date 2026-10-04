import {type ActionFunctionArgs, type LoaderFunctionArgs} from 'react-router';

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const;

function shopifyStoreDomain(env: Env) {
  const domain = (
    env.SHOPIFY_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN
  )?.trim().toLowerCase();
  return domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)
    ? domain
    : null;
}

/**
 * Fastrr's Shopify-channel SDK posts order authentication back to the current
 * host. On Hydrogen that host is Oxygen, so forward the POST to Shopify's
 * Online Store host while preserving its body and query string.
 */
export async function action({request, context, params}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {...NO_STORE_HEADERS, Allow: 'POST'},
    });
  }

  const {shopId, orderToken} = params;
  const storeDomain = shopifyStoreDomain(context.env);
  if (
    !storeDomain ||
    !shopId ||
    !/^\d{1,32}$/.test(shopId) ||
    !orderToken ||
    !/^[A-Za-z0-9]{16,128}$/.test(orderToken)
  ) {
    return new Response('Invalid Shopify order authentication target', {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const source = new URL(request.url);
  const target = new URL(
    `/${shopId}/orders/${orderToken}/authenticate`,
    `https://${storeDomain}`,
  );
  target.search = source.search;

  // 307 is intentional: Shopify's authenticate endpoint requires POST and the
  // browser must resend Fastrr's form body to the canonical Shopify host.
  return new Response(null, {
    status: 307,
    headers: {
      ...NO_STORE_HEADERS,
      Location: target.toString(),
    },
  });
}

export function loader(_args: LoaderFunctionArgs) {
  return new Response('Method not allowed', {
    status: 405,
    headers: {...NO_STORE_HEADERS, Allow: 'POST'},
  });
}
