import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {sentryVitePlugin} from '@sentry/vite-plugin';

const sentryRelease = process.env.SENTRY_RELEASE || '';
const uploadSentryMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && sentryRelease);

export default defineConfig({
  plugins: [
    hydrogen(),
    oxygen(),
    reactRouter(),
    tsconfigPaths(),
    ...(uploadSentryMaps ? [sentryVitePlugin({
      org: 'ulkam-group',
      project: 'javascript-react-router',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {name: sentryRelease},
      sourcemaps: {
        assets: './build/client/assets/**/*.js',
        filesToDeleteAfterUpload: './build/client/assets/**/*.js.map',
      },
      telemetry: false,
    })] : []),
  ],
  define: {'__SENTRY_RELEASE__': JSON.stringify(sentryRelease)},
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
      // Vite's native tsconfig path resolver does not cover JavaScript
      // projects that use jsconfig.json, so define Hydrogen's app alias here.
      {find: '~', replacement: fileURLToPath(new URL('./app', import.meta.url))},
    ],
  },
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
    sourcemap: uploadSentryMaps ? 'hidden' : false,
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /Users/.../node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
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
  server: {
    allowedHosts: ['.tryhydrogen.dev'],
  },
});
