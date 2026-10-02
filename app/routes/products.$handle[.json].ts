import type {Route} from './+types/products.$handle[.json]';
import {loadShopifyAjaxProduct} from './products.$handle[.js].ts';

/** Shopify's newer product Ajax endpoint wraps the product in an object. */
export async function loader(args: Route.LoaderArgs) {
  const response = await loadShopifyAjaxProduct(args);
  if (!response.ok) return response;

  return Response.json(
    {product: await response.json()},
    {headers: response.headers},
  );
}
