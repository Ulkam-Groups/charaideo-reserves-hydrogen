import {data} from 'react-router';
import type {Route} from './+types/api.cart-state';

export async function loader({context}: Route.LoaderArgs) {
  return data(
    {cart: await context.cart.get()},
    {headers: {'Cache-Control': 'no-store'}},
  );
}
