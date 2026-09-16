import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {applySecurityHeaders} from '~/lib/security-headers';
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
    let stage = 'context';
    try {
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
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
        return applySecurityHeaders(redirectResponse, new URL(request.url));
      }

      return response;
    } catch (error) {
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
    }
  },
};

function redactDebugMessage(message: string) {
  return message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]');
}
