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
import favicon from '~/assets/favicon.svg?url';
import {buildAnalyticsConsent} from '~/lib/analytics';
import {
  measureOptionalStorefront,
  monitoringEnabled,
  sentryIngestOrigin,
} from '~/lib/monitoring.server';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {FASTRR_ASSETS} from '~/lib/checkout/providers/fastrr/fastrr.config';
import {RAZORPAY_ASSETS} from '~/lib/checkout/providers/razorpay/razorpay.config';

const SHOPIFY_CHAT_SCRIPT = 'https://cdn.shopify.com/storefront/web-components/chat.js';
const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap';
export function links() {
  return [
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
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
  const checkoutProvider = resolveCheckoutProvider(env.CHECKOUT_PROVIDER);
  const fastrrSellerDomain =
    checkoutProvider === 'fastrr'
      ? env.PUBLIC_FASTRR_SELLER_DOMAIN?.trim() || null
      : null;
  const razorpayReady =
    checkoutProvider === 'razorpay' &&
    Boolean(
      env.RAZORPAY_KEY_ID?.trim() &&
        env.RAZORPAY_KEY_SECRET?.trim() &&
        env.RAZORPAY_WEBHOOK_SECRET?.trim() &&
        env.SHOPIFY_ADMIN_CLIENT_ID?.trim() &&
        env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim() &&
        /^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(
          (
            env.SHOPIFY_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN
          )?.trim() ?? '',
        ),
    );

  const header = await measureOptionalStorefront(context.monitor, 'header', () =>
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
    checkoutProvider,
    checkoutReady:
      checkoutProvider === 'fastrr'
        ? Boolean(fastrrSellerDomain)
        : razorpayReady,
    fastrrSellerDomain,
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
        <link rel="stylesheet" href={stylesheet} />
        <link rel="stylesheet" href={identity} />
        <link rel="stylesheet" href={revamp} />
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
            src={FASTRR_ASSETS.script}
          />
        )}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <DeferredStylesheet href={GOOGLE_FONTS_STYLESHEET} />
        {data.fastrrSellerDomain && (
          <DeferredStylesheet href={FASTRR_ASSETS.stylesheet} />
        )}
        {data.checkoutProvider === 'razorpay' && data.checkoutReady && (
          <Script waitForHydration src={RAZORPAY_ASSETS.script} />
        )}
        <ShopifyChat storeDomain={data.chatShopDomain} />
      </body>
    </html>
  );
}

function DeferredStylesheet({href}: {href: string}) {
  useEffect(() => {
    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).some((link) => link.href === href);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}

function ShopifyChat({storeDomain}: {storeDomain: string}) {
  // Web components can mutate their host nodes before React hydrates server markup.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (document.querySelector('script[data-shopify-chat-script]')) return;

    // Hydrogen's lazy Script path applies attributes after inserting the
    // element. A module must have its type set before insertion, otherwise the
    // browser prepares chat.js as a classic script and rejects import.meta.
    const script = document.createElement('script');
    script.type = 'module';
    script.crossOrigin = 'anonymous';
    script.src = SHOPIFY_CHAT_SCRIPT;
    script.dataset.shopifyChatScript = 'true';
    document.body.appendChild(script);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <script
        id="shopify-chat-app-embed-data"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html:
            '{"settings":{"horizontalPosition":"right","invertActivatorColors":true}}',
        }}
      />
      <shopify-store store-domain={storeDomain} country="IN" language="en">
        <shopify-chat mode="standalone" />
      </shopify-store>
    </>
  );
}
