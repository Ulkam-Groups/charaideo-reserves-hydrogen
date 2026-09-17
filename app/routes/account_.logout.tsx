import {redirect} from 'react-router';
import type {Route} from './+types/account_.logout';
import {readProtectedForm} from '~/lib/protected-write.server';

// if we don't implement this, /account/logout will get caught by account.$.tsx to do login
export async function loader() {
  return redirect('/');
}

export async function action({request, context}: Route.ActionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 1024});
  if (form instanceof Response) return form;
  return context.customerAccount.logout();
}
