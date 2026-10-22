import {redirect, type ActionFunctionArgs} from 'react-router';
import {marketCookie} from '~/lib/markets';
import {readProtectedForm} from '~/lib/protected-write.server';
import {safeLocalRedirect} from '~/lib/redirect';

export async function action({request}: ActionFunctionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 1024});
  if (form instanceof Response) return form;

  const country = form.get('country');
  if (typeof country !== 'string') return new Response('Invalid market', {status: 400});

  let cookie: string;
  try {
    cookie = marketCookie(country, new URL(request.url).protocol === 'https:');
  } catch {
    return new Response('Unsupported market', {status: 400});
  }

  return redirect(safeLocalRedirect(form.get('redirectTo'), '/'), {
    headers: {'Set-Cookie': cookie},
  });
}
