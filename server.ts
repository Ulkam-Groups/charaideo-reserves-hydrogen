import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {applySecurityHeaders} from '~/lib/security-headers';
import {createMonitorIfEnabled} from '~/lib/sentry-client.server';
/**
 * Export a fetch handler in module format.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    const monitor = createMonitorIfEnabled(env.SENTRY_ENABLED, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT, requestId);
    const started = monitor ? performance.now() : 0;
    const routeGroup = monitor ? classifyRoute(new URL(request.url).pathname) : 'other';
    let stage = 'context';
    let status = 500;
    try {
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
        monitor,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      stage = 'request-handler';
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);
      status = response.status;

      stage = 'response-headers';
      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      response.headers.set('X-Request-Id', requestId);
      applySecurityHeaders(response, new URL(request.url));

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        const redirectResponse = await storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
        redirectResponse.headers.set('X-Request-Id', requestId);
        status = redirectResponse.status;
        return applySecurityHeaders(redirectResponse, new URL(request.url));
      }

      return response;
    } catch (error) {
      monitor?.failure('storefront.request.exception', {stage, routeGroup}, error);
      console.error(JSON.stringify({
        level: 'error',
        scope: 'request',
        stage,
        requestId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        ...(process.env.NODE_ENV !== 'production' && error instanceof Error
          ? {debugMessage: redactDebugMessage(error.message)}
          : {}),
      }));
      const response = new Response('An unexpected error occurred', {
        status: 500,
        headers: {'X-Request-Id': requestId},
      });
      return applySecurityHeaders(response, new URL(request.url));
    } finally {
      if (monitor) {
        monitor.count('storefront.request.count', {status, method: request.method, routeGroup});
        if (status === 429 || status >= 500) {
          monitor.failure('storefront.http.failure', {status, routeGroup, method: request.method});
        }
        monitor.duration('storefront.request.duration', performance.now() - started, {
          status,
          method: request.method,
          routeGroup,
        });
        try {
          monitor.flush(executionContext.waitUntil.bind(executionContext));
        } catch {
          // Monitoring must never change the storefront response.
        }
      }
    }
  },
};

function redactDebugMessage(message: string) {
  return message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]');
}

function classifyRoute(pathname: string) {
  if (pathname === '/search') return 'search';
  if (pathname.startsWith('/account')) return 'account';
  if (pathname.startsWith('/cart')) return 'cart';
  if (pathname.startsWith('/products/')) return 'product';
  return 'other';
}
