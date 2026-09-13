import {redirect} from 'react-router';
import type {Route} from './+types/blends';

export async function loader(_: Route.LoaderArgs) {
  // Custom blend checkout is retired. Send old bookmarks to the standard
  // Shopify product collection instead of leaving a privileged purchase path.
  return redirect('/collections/all', {status: 302});
}

export default function Blends() {
  return null;
}
