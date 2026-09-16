import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    styleSrc: ['https://fonts.googleapis.com', 'https://fastrr-boost-ui.pickrr.com'],
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://fastrr-boost-ui.pickrr.com',
      'https://sr-cdn.shiprocket.in',
    ],
    connectSrc: [
      'https://fastrr-boost-ui.pickrr.com',
      'https://sr-cdn.shiprocket.in',
    ],
    frameSrc: ['https://fastrr-boost-ui.pickrr.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://fastrr-boost-ui.pickrr.com',
      'https://sr-cdn.shiprocket.in',
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
