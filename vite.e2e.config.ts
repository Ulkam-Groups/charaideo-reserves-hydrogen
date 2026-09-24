import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Isolated test runtime backed by the deterministic local Storefront fixture.
export default defineConfig({
  plugins: [
    hydrogen(),
    oxygen({
      env: {
        PUBLIC_STORE_DOMAIN: 'http://127.0.0.1:4174',
        PUBLIC_STOREFRONT_API_TOKEN: 'e2e-token',
        PRIVATE_STOREFRONT_API_TOKEN: '',
        PUBLIC_STOREFRONT_ID: '0',
        PUBLIC_FASTRR_SELLER_DOMAIN: 'e2e.invalid',
        PUBLIC_CHECKOUT_DOMAIN: 'checkout.invalid',
        SENTRY_ENABLED: 'false',
        SENTRY_DSN: 'https://public@o1.ingest.sentry.io/123',
        SESSION_SECRET: 'playwright-test-session-secret-32-characters',
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
});
