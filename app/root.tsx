import {Analytics, getShopAnalytics, Script, useNonce} from '@shopify/hydrogen';
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

  const header = await storefront.query(HEADER_QUERY, {
    variables: {
      headerMenuHandle: 'main-menu',
    },
    cache: storefront.CacheLong(),
  });

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
    fastrrSellerDomain: env.PUBLIC_FASTRR_SELLER_DOMAIN?.trim() || null,
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
      </body>
    </html>
  );
}
