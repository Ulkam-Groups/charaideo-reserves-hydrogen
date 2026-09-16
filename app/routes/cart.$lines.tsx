import {redirect} from 'react-router';
import type {Route} from './+types/cart.$lines';
import {parseCartPermalink} from '~/lib/storefront-input';

/**
 * Automatically creates a new cart based on the URL and opens the cart page.
 * Expected URL structure:
 * ```js
 * /cart/<variant_id>:<quantity>
 *
 * ```
 *
 * More than one `<variant_id>:<quantity>` separated by a comma, can be supplied in the URL, for
 * carts with more than one product variant.
 *
 * @example
 * Example path creating a cart with two product variants, different quantities, and a discount code in the querystring:
 * ```js
 * /cart/41007289663544:1,41007289696312:2?discount=HYDROBOARD
 *
 * ```
 */
export async function loader({request, context, params}: Route.LoaderArgs) {
  const {cart} = context;
  const {lines} = params;
  if (!lines) return redirect('/cart');
  const url = new URL(request.url);
  let cartInput;
  try {
    cartInput = parseCartPermalink(lines, url.searchParams.get('discount'));
  } catch {
    throw new Response('Invalid cart link.', {
      status: 400,
      headers: {'Cache-Control': 'no-store'},
    });
  }

  // create a cart
  const result = await cart.create({
    lines: cartInput.lines,
    discountCodes: cartInput.discountCodes,
  });

  const cartResult = result.cart;

  if (result.errors?.length || !cartResult) {
    throw new Response('Link may be expired. Try checking the URL.', {
      status: 410,
    });
  }

  // Update cart id in cookie
  const headers = cart.setCartId(cartResult.id);

  return redirect('/cart', {headers});
}

export default function Component() {
  return null;
}
