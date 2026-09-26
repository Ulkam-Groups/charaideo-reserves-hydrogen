import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Isolated test runtimes backed by the deterministic local Storefront fixture.
export default defineConfig(({mode}) => {
  const razorpay = mode === 'razorpay';

  return {
    cacheDir: razorpay
      ? 'node_modules/.vite-e2e-razorpay'
      : 'node_modules/.vite-e2e-fastrr',
    plugins: [
      hydrogen(),
      oxygen({
        env: {
          PUBLIC_STORE_DOMAIN: 'http://127.0.0.1:4174',
          PUBLIC_STOREFRONT_API_TOKEN: 'e2e-token',
          PRIVATE_STOREFRONT_API_TOKEN: '',
          PUBLIC_STOREFRONT_ID: '0',
          PUBLIC_CHECKOUT_DOMAIN: 'checkout.invalid',
          SENTRY_ENABLED: 'false',
          SENTRY_DSN: 'https://public@o1.ingest.sentry.io/123',
          SESSION_SECRET: 'playwright-test-session-secret-32-characters',
          ...(razorpay
            ? {
                CHECKOUT_PROVIDER: 'razorpay',
                RAZORPAY_KEY_ID: 'rzp_test_e2e',
                RAZORPAY_KEY_SECRET: 'e2e-secret',
                RAZORPAY_WEBHOOK_SECRET: 'e2e-webhook-secret',
                SHOPIFY_ADMIN_CLIENT_ID: 'e2e-client',
                SHOPIFY_ADMIN_CLIENT_SECRET: 'e2e-admin-secret',
                SHOPIFY_ADMIN_STORE_DOMAIN: 'e2e-store.myshopify.com',
              }
            : {
                CHECKOUT_PROVIDER: 'fastrr',
                PUBLIC_FASTRR_SELLER_DOMAIN: 'e2e.invalid',
              }),
        },
      }),
      reactRouter(),
      tsconfigPaths(),
    ],
    resolve: {
      alias: [
        {
          find: /^razorpay$/,
          replacement: fileURLToPath(
            new URL(
              './app/lib/checkout/providers/razorpay/razorpay-oxygen.server.ts',
              import.meta.url,
            ),
          ),
        },
        {
          find: /^crypto$/,
          replacement: fileURLToPath(
            new URL(
              './app/lib/checkout/providers/razorpay/crypto-compat.server.ts',
              import.meta.url,
            ),
          ),
        },
        {find: '~', replacement: fileURLToPath(new URL('./app', import.meta.url))},
      ],
    },
    build: {assetsInlineLimit: 0},
    ssr: {
      optimizeDeps: {
        include: [
          'react-router > set-cookie-parser',
          'react-router > cookie',
          'react-router',
          'razorpay/dist/api.js',
          'razorpay/dist/resources/orders.js',
          'razorpay/dist/resources/payments.js',
        ],
      },
    },
  };
});
