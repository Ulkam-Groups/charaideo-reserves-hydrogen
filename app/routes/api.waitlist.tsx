import type {Route} from './+types/api.waitlist';
import {saveWaitlistSubscriber, WaitlistError} from '~/lib/waitlist.server';

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({error: 'Method not allowed'}, {status: 405});
  }

  let body: {email?: unknown; consent?: unknown};
  try {
    body = await request.json();
  } catch {
    return Response.json({error: 'Invalid JSON'}, {status: 400});
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({error: 'Valid email required'}, {status: 400});
  }
  if (body.consent !== true) {
    return Response.json({error: 'Email consent required'}, {status: 400});
  }

  try {
    await saveWaitlistSubscriber(email, context.env);
    return Response.json({ok: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Waitlist signup failed', error instanceof WaitlistError ? error.message : 'Unexpected error');
    return Response.json(
      {error: error instanceof WaitlistError ? error.message : 'Unable to save your email'},
      {status: error instanceof WaitlistError ? error.status : 502},
    );
  }
}
