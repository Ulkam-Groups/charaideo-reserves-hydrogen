import {Analytics, getShopAnalytics, Script, useNonce} from '@shopify/hydrogen';
import {useEffect, useState} from 'react';
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
import {HEADER_QUERY} from '~/lib/fragments';
import stylesheet from '~/styles/app.css?url';
import identity from '~/styles/identity.css?url';
import revamp from '~/styles/revamp.css?url';
import {buildAnalyticsConsent} from '~/lib/analytics';
import {
  measureStorefront,
  monitoringEnabled,
  sentryIngestOrigin,
} from '~/lib/monitoring.server';

const SHOPIFY_CHAT_SCRIPT = 'https://cdn.shopify.com/storefront/web-components/chat.js';

export function links() {
  return [
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous'},
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

  return {
    cart: cart.get(),
    consent: buildAnalyticsConsent(env),
    header,
    isLoggedIn: customerAccount.isLoggedIn(),
    publicStoreDomain,
    chatShopDomain,
    fastrrSellerDomain: env.PUBLIC_FASTRR_SELLER_DOMAIN?.trim() || null,
    sentryDsn:
      monitoringEnabled(env.SENTRY_ENABLED) && sentryIngestOrigin(env.SENTRY_DSN)
        ? env.SENTRY_DSN
        : null,
    sentryEnvironment: env.SENTRY_ENVIRONMENT?.trim() || 'production',
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID || '0',
    }),
  };
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
        {data.sentryDsn && (
          <meta name="sentry-environment" content={data.sentryEnvironment} />
        )}
        <Meta />
        <Links />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=General+Sans:wght@400;500;600&display=swap"
        />
        <link rel="stylesheet" href={stylesheet} />
        <link rel="stylesheet" href={identity} />
        <link rel="stylesheet" href={revamp} />
        {data.fastrrSellerDomain && (
          <link
            rel="stylesheet"
            href="https://fastrr-boost-ui.pickrr.com/assets/styles/shopify.css"
          />
        )}
      </head>
      <body>
        {data.fastrrSellerDomain && (
          <input
            type="hidden"
            id="sellerDomain"
            value={data.fastrrSellerDomain}
            readOnly
          />
        )}
        <Analytics.Provider cart={data.cart} consent={data.consent} shop={data.shop}>
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
        <ShopifyChat storeDomain={data.chatShopDomain} />
      </body>
    </html>
  );
}

function ShopifyChat({storeDomain}: {storeDomain: string}) {
  // Web components can mutate their host nodes before React hydrates server markup.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      <shopify-store store-domain={storeDomain} country="IN" language="en">
        <shopify-chat mode="standalone" />
      </shopify-store>
      <Script
        waitForHydration
        type="module"
        crossOrigin="anonymous"
        src={SHOPIFY_CHAT_SCRIPT}
      />
    </>
  );
}
