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
