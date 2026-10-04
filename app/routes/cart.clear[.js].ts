import {type ActionFunctionArgs, type LoaderFunctionArgs} from 'react-router';

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const;

/**
 * Shopify Ajax Cart compatibility endpoint used by Fastrr after checkout.
 * Hydrogen carts are cleared through the Storefront Cart API instead of the
 * Online Store `/cart/clear.js` endpoint.
 */
export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {...NO_STORE_HEADERS, Allow: 'POST'},
    });
  }

  const currentCart = await context.cart.get();
  const lineIds =
    currentCart?.lines?.nodes.map((line: {id: string}) => line.id) ?? [];
  if (lineIds.length > 0) await context.cart.removeLines(lineIds);

  // Fastrr parses this endpoint as JSON before following its order redirect.
  return Response.json(
    {item_count: 0, items: [], total_price: 0},
    {headers: NO_STORE_HEADERS},
  );
}

export function loader(_args: LoaderFunctionArgs) {
  return new Response('Method not allowed', {
    status: 405,
    headers: {...NO_STORE_HEADERS, Allow: 'POST'},
  });
}
