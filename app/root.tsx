import {Analytics, getShopAnalytics, Script, useNonce} from '@shopify/hydrogen';
import {useEffect} from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import {PageLayout} from '~/components/PageLayout';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import stylesheet from '~/styles/app.css?url';
import identity from '~/styles/identity.css?url';
import riverThread from '../river-thread-web/river-thread-calligraphy.css?url';
import {buildAnalyticsConsent} from '~/lib/analytics';
import {measureStorefront, monitoringEnabled, sentryIngestOrigin} from '~/lib/monitoring.server';

export function links() {
  return [
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous'},
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Manrope:wght@400;500;600&display=swap',
    },
    {rel: 'stylesheet', href: stylesheet},
    {rel: 'stylesheet', href: riverThread},
    {rel: 'stylesheet', href: identity},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  const {cart, customerAccount, env, storefront} = context;
  const publicStoreDomain = env.PUBLIC_STORE_DOMAIN;
  const configuredChatShop = env.PUBLIC_SHOPIFY_CHAT_SHOP?.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const chatShopDomain = `https://${
    configuredChatShop || 'charaideoreserves.myshopify.com'
  }`;

  const header = await measureStorefront(context.monitor, 'header', () =>
    storefront.query(HEADER_QUERY, {
      variables: {headerMenuHandle: 'main-menu'},
      cache: storefront.CacheLong(),
    }),
  );

  const footer = storefront
    .query(FOOTER_QUERY, {
      variables: {
        footerMenuHandle: 'footer',
      },
      cache: storefront.CacheLong(),
    })
    .catch(() => {
      console.error('Footer query failed.');
      return null;
    });

  return {
    cart: cart.get(),
    consent: buildAnalyticsConsent(env),
    footer,
    header,
    isLoggedIn: customerAccount.isLoggedIn(),
    publicStoreDomain,
    chatShopDomain,
    fastrrSellerDomain: env.PUBLIC_FASTRR_SELLER_DOMAIN?.trim() || null,
    sentryDsn: monitoringEnabled(env.SENTRY_ENABLED) && sentryIngestOrigin(env.SENTRY_DSN)
      ? env.SENTRY_DSN
      : null,
    sentryEnvironment: env.SENTRY_ENVIRONMENT?.trim() || 'production',
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID || '0',
    }),
  };
}

function ShopifyChatScript() {
  useEffect(() => {
    if (document.querySelector('script[data-shopify-chat-script]')) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.defer = true;
    script.src = 'https://cdn.shopify.com/storefront/web-components/chat.js';
    script.dataset.shopifyChatScript = 'true';
    document.body.appendChild(script);
  }, []);

  return null;
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {data.sentryDsn && <meta name="sentry-dsn" content={data.sentryDsn} />}
        {data.sentryDsn && <meta name="sentry-environment" content={data.sentryEnvironment} />}
        <Meta />
        <Links />
        {data.fastrrSellerDomain && (
          <link rel="stylesheet" href="https://fastrr-boost-ui.pickrr.com/assets/styles/shopify.css" />
        )}
      </head>
      <body>
        {data.fastrrSellerDomain && (
          <input type="hidden" id="sellerDomain" value={data.fastrrSellerDomain} readOnly />
        )}
        <Analytics.Provider
          cart={data.cart}
          consent={data.consent}
          shop={data.shop}
        >
          <PageLayout {...data}>
            <Outlet />
          </PageLayout>
        </Analytics.Provider>
        {data.fastrrSellerDomain && (
          <Script
            waitForHydration
            src="https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js"
          />
        )}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <shopify-store
          store-domain={data.chatShopDomain}
          country="IN"
          language="en"
        >
          <shopify-chat mode="standalone" />
        </shopify-store>
        <ShopifyChatScript />
      </body>
    </html>
  );
}
