import {redirect} from 'react-router';
import type {Route} from './+types/account.$';
import {requireCustomerAuthStatus} from '~/lib/customer-auth.server';

// fallback wild card for all unauthenticated routes in account section
export async function loader({context}: Route.LoaderArgs) {
  await requireCustomerAuthStatus(context.customerAccount);

  return redirect('/account');
}
