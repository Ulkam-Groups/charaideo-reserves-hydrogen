import {createHydrogenContext} from '@shopify/hydrogen';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import type {Monitor} from '~/lib/monitoring.server';
import {localeFromRequest, storefrontI18n, type StorefrontLocale} from '~/lib/i18n';

type AdditionalContextType = {
  reviewsCache: Cache;
  monitor: Monitor | null;
  requestId: string;
  locale: StorefrontLocale;
};

declare global {
  interface HydrogenAdditionalContext extends AdditionalContextType {}
}

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 * */
export async function createHydrogenRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
  monitor: Monitor | null = null,
  requestId: string = crypto.randomUUID(),
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const locale = localeFromRequest(request, session.get('localePreference'));
  const firstPathSegment = new URL(request.url).pathname.split('/').filter(Boolean)[0];

  // A locale in the URL is an explicit choice. Remember it so subsequent
  // unprefixed navigation in this browser session keeps the same market.
  if (locale.prefix && firstPathSegment?.toLowerCase() === locale.prefix) {
    if (session.get('localePreference') !== locale.key) {
      session.set('localePreference', locale.key);
    }
  }
  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      i18n: storefrontI18n(locale),
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
      },
    },
    {reviewsCache: cache, monitor, requestId, locale},
  );

  return hydrogenContext;
}
