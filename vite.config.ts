import {fileURLToPath} from 'node:url';
import {defineConfig, type Plugin} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {sentryVitePlugin} from '@sentry/vite-plugin';
import {
  ALLOWED_SHOPIFY_CHAT_ASSET,
  rewriteShopifyChatAssetSource,
  SHOPIFY_CHAT_ASSET_ORIGIN,
  SHOPIFY_CHAT_LOCAL_PREFIX,
  SHOPIFY_CHAT_REMOTE_PREFIX,
} from './app/lib/shopify-chat-assets';

const sentryRelease = process.env.SENTRY_RELEASE || '';
const uploadSentryMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && sentryRelease);

function shopifyChatDevProxy(): Plugin {
  const cache = new Map<string, string>();
  let fetchQueue = Promise.resolve();

  const load = (assetPath: string) => {
    const cached = cache.get(assetPath);
    if (cached) return Promise.resolve(cached);

    const pending = fetchQueue.then(async () => {
      const upstreamUrl = new URL(
        `${SHOPIFY_CHAT_REMOTE_PREFIX}${assetPath}`,
        SHOPIFY_CHAT_ASSET_ORIGIN,
      );
      const response = await fetch(upstreamUrl);
      if (!response.ok) {
        throw new Error(`Shopify chat CDN returned ${response.status}`);
      }
      const source = rewriteShopifyChatAssetSource(
        assetPath,
        await response.text(),
      );
      cache.set(assetPath, source);
      return source;
    });
    fetchQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  return {
    name: 'charaideo-shopify-chat-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');
        if (!requestUrl.pathname.startsWith(SHOPIFY_CHAT_LOCAL_PREFIX)) {
          next();
          return;
        }
        const assetPath = requestUrl.pathname.slice(
          SHOPIFY_CHAT_LOCAL_PREFIX.length,
        );
        if (!ALLOWED_SHOPIFY_CHAT_ASSET.test(assetPath)) {
          next();
          return;
        }

        try {
          const source = await load(assetPath);
          response.statusCode = 200;
          response.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8',
          );
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('X-Content-Type-Options', 'nosniff');
          response.end(source);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    shopifyChatDevProxy(),
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
