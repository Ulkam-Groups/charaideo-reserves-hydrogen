import {data} from 'react-router';
import type {Route} from './+types/api.cart-state';

export async function loader({context}: Route.LoaderArgs) {
  try {
    return data(
      {cart: await context.cart.get(), unavailable: false},
      {headers: {'Cache-Control': 'no-store'}},
    );
  } catch {
    return data(
      {cart: null, unavailable: true},
      {headers: {'Cache-Control': 'no-store'}},
    );
  }
}
