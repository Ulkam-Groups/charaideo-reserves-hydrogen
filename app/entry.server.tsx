import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';
import {monitoringEnabled, sentryIngestOrigin} from '~/lib/monitoring.server';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {FASTRR_CSP} from '~/lib/checkout/providers/fastrr/fastrr.config';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const sentryOrigin = monitoringEnabled(context.env?.SENTRY_ENABLED)
    ? sentryIngestOrigin(context.env?.SENTRY_DSN)
    : null;
  const fastrrEnabled =
    resolveCheckoutProvider(context.env?.CHECKOUT_PROVIDER) === 'fastrr';
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    styleSrc: [
      'https://fonts.googleapis.com',
      ...(fastrrEnabled ? FASTRR_CSP.styleSrc : []),
    ],
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      ...(fastrrEnabled ? FASTRR_CSP.scriptSrc : []),
    ],
    connectSrc: [
      ...(sentryOrigin ? [sentryOrigin] : []),
      'https://cdn.shopify.com',
      'https://messaging-api.shopifyapps.com',
      'https://otlp-http-production.shopifysvc.com',
      ...(fastrrEnabled ? FASTRR_CSP.connectSrc : []),
    ],
    frameSrc: [
      "'self'",
      ...(fastrrEnabled ? FASTRR_CSP.frameSrc : []),
      'https://storefront-agent-server.shopify.ai',
    ],
    mediaSrc: ["'self'", 'data:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      ...(fastrrEnabled ? FASTRR_CSP.imgSrc : []),
      'https://images.unsplash.com',
      'data:',
    ],
    shop: {
      checkoutDomain:
        context.env?.PUBLIC_CHECKOUT_DOMAIN ??
        process.env.PUBLIC_CHECKOUT_DOMAIN ??
        '',
      storeDomain:
        context.env?.PUBLIC_STORE_DOMAIN ??
        process.env.PUBLIC_STORE_DOMAIN ??
        '',
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        context.monitor?.failure('storefront.ssr.failure', {}, error);
        console.error(JSON.stringify({
          level: 'error',
          scope: 'ssr',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }));
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
