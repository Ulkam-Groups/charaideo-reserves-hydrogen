import type {Route} from './+types/api.waitlist';

export async function action({request}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({error: 'Method not allowed'}, {status: 405});
  }

  let body: {email?: unknown; tags?: unknown};
  try {
    body = await request.json();
  } catch {
    return Response.json({error: 'Invalid JSON'}, {status: 400});
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({error: 'Valid email required'}, {status: 400});
  }

  // TODO: Forward {email, tags: ['waitlist', 'chapter-1', 'first-100']}
  // to Klaviyo and create/tag the Shopify customer after credentials and
  // consent requirements are configured. The approved homepage currently
  // shows a client-side confirmation only; no address is persisted yet.
  return Response.json({error: 'Waitlist integration is not configured'}, {status: 501});
}
