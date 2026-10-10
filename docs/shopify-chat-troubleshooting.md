# Shopify chat proxy troubleshooting

Shopify updated its storefront chat bundles without changing our integration: the
iframe added hashed relative module imports, and the parent runtime changed its
iframe-origin helper from `qt` to `zt`. Our asset proxy initially returned 404
for the new iframe imports; after allowing them, the parent still rejected the
iframe's `iframe-ready` message from localhost, showing “Chat isn’t available.”

When chat breaks after a Shopify bundle update, inspect DevTools Network and the
current proxied `chat/agent-runtime-*.js` and `agent-iframe.js`. Keep new relative
modules within the restricted local asset proxy, and update the runtime-origin
rewrite to the current helper so it returns `window.location.origin`. Then
verify the iframe handshake, agent API calls, and composer. Focused regression
coverage is in `tests/shopify-chat-proxy.test.ts`.

In October 2026 Shopify changed the minified helper names again: `zt` became a
cart-line normalizer and the iframe-origin helper returned to `qt`. The proxy no
longer rewrites a minified function name. It now rewrites the stable
`iframeShellOrigin:<helper>()` constructor property directly to
`iframeShellOrigin:window.location.origin`, so helper renames do not break the
same-origin iframe handshake.

## 2026-10-10: helper rename and concurrent development asset failures

The chat opened briefly and then failed while the browser requested hashed
modules such as `icon-submit-*.js`, `host-monorail-*.js`, and
`shopify-chat-telemetry-*.js`. Some requests returned HTTP 500 from localhost.
This incident had two independent causes:

1. Shopify's current `agent-runtime-*.js` changed the iframe-origin helper back
   to `qt`; `zt` now normalizes cart lines. A rewrite tied to either minified
   name can therefore patch the wrong function or stop matching entirely.
2. During local development, concurrent requests for Shopify's module graph
   intermittently passed through MiniOxygen and failed with `Error: The script
   will never generate a response.` The iframe could appear for a moment before
   a required child module failed, making the handshake look like the only
   problem.

The durable repair is split by responsibility:

- `rewriteShopifyChatAssetSource` rewrites the stable call-site property
  `iframeShellOrigin:<helper>()` to
  `iframeShellOrigin:window.location.origin`. Do not target `qt`, `zt`, or any
  other minified function name.
- In development, the Vite chat-asset middleware runs before MiniOxygen. It
  restricts requests to the same asset allowlist as the production route,
  serializes Shopify CDN fetches, caches their source in memory, applies the
  shared rewrite, and serves the complete module graph locally.
- Production continues to use the secured `/shopify-chat-assets/*` route
  proxy; the development middleware is not a replacement for that route.

For a future recurrence, check these separately:

1. Fetch `/shopify-chat-assets/chat.js`, follow its current
   `agent-runtime-<hash>.js` import, and confirm that every hashed child module
   returns HTTP 200 rather than testing only the entry bundle.
2. Confirm the served runtime contains
   `iframeShellOrigin:window.location.origin` at the constructor call site.
3. In the browser, verify the iframe sends `shopify-agent:iframe-ready` from
   the storefront origin and the parent answers with `shopify-agent:port`.
4. Confirm `/shopify-agent-api/api/buyer_context/warm` and the store
   `empty_state` request succeed, then visually verify the real Shopify composer
   is attached to the navigation bar.

Regression coverage belongs in `tests/shopify-chat-proxy.test.ts`. Its runtime
fixture must deliberately use an arbitrary helper name so the test protects the
stable property rewrite rather than today's minified identifier.
