import type {Route} from './+types/api.waitlist';
import {saveWaitlistSubscriber, WaitlistError} from '~/lib/waitlist.server';
import {readWaitlistRequest} from '~/lib/waitlist-guard.server';
import {enforceApiRateLimit} from '~/lib/api-rate-limit.server';

export async function action({request, context}: Route.ActionArgs) {
  const submission = await readWaitlistRequest(request);
  if (submission instanceof Response) return submission;

  try {
    const cache = await caches.open('api-rate-limits');
    const limit = await enforceApiRateLimit(request, cache, '/api/waitlist');
    if (limit) return limit;
    await saveWaitlistSubscriber(submission.email, context.env);
    return Response.json({ok: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error(
      'Waitlist signup failed',
      error instanceof WaitlistError ? error.message : 'Unexpected error',
    );
    return Response.json(
      {
        error:
          error instanceof WaitlistError ? error.message : 'Unable to save your email',
      },
      {status: error instanceof WaitlistError ? error.status : 502},
    );
  }
}
