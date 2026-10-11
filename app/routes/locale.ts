import {redirect} from 'react-router';
import type {Route} from './+types/locale';
import {LOCALES, switchLocalePath, type LocaleKey} from '~/lib/i18n';
import {readProtectedForm} from '~/lib/protected-write.server';

export async function action({request, context}: Route.ActionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 8_192});
  if (form instanceof Response) return form;
  const destination = String(form.get('locale') || '') as LocaleKey;
  if (!(destination in LOCALES)) throw new Response('Unsupported locale', {status: 400});
  const returnTo = String(form.get('returnTo') || '/');
  const destinationPath = switchLocalePath(returnTo.startsWith('/') ? returnTo : '/', destination);
  const existingCart = await context.cart.get();
  if (existingCart) await context.cart.updateBuyerIdentity({countryCode: LOCALES[destination].country});
  context.session.set('localePreference', destination);
  return redirect(destinationPath, 303);
}

export async function loader() {
  return redirect('/', 302);
}
