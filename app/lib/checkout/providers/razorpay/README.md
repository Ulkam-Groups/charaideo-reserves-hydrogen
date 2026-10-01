# Razorpay Magic Checkout provider

This folder contains all Razorpay-specific checkout code and configuration.

- `razorpay.ts` contains SSR-safe validation and Magic Checkout order payload construction.
- `razorpay.client.ts` creates an order through the storefront, opens `magic-checkout.js`, and submits the payment result for server verification.
- `razorpay.server.ts` creates orders with the official `razorpay` SDK and verifies signatures with Oxygen's Web Crypto API without exposing the key secret.
- `razorpay-oxygen.server.ts` initializes only the official SDK's API, Orders, and Payments modules used by this storefront; the package's main class eagerly imports Node-only modules that Oxygen cannot load.
- `crypto-compat.server.ts` blocks accidental use of the SDK's Node-only crypto helpers. Payment and webhook HMAC verification remains in `razorpay.server.ts`.
- `razorpay-order.server.ts` fetches and validates the final Razorpay order/payment, then either completes its anchored Shopify Draft Order or uses the legacy `orderCreate` path through Admin GraphQL.
- `razorpay.config.ts` owns the Magic Checkout script URL and CSP sources.

Set `CHECKOUT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_CLIENT_ID`, and `SHOPIFY_ADMIN_CLIENT_SECRET` to enable this provider. Set `SHOPIFY_ADMIN_STORE_DOMAIN` to the shop's canonical `*.myshopify.com` domain when `PUBLIC_STORE_DOMAIN` points elsewhere; otherwise the public domain is used. The Shopify app installation needs `read_orders,write_orders`. `RAZORPAY_BUSINESS_NAME` is optional and defaults to `Charaideo Reserves`.

`RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true` enables the Draft Order reconciliation path. Before creating the Razorpay order, the order endpoint creates an uncompleted Shopify Draft Order and stores its GID in both the Razorpay order notes (`shopify_draft_order_id`) and the server session. After a captured payment is fully validated, browser verification updates that exact draft with the verified address, shipping charge, Razorpay IDs and payment method, requires the recalculated Shopify total to equal the captured Razorpay amount, and calls `draftOrderComplete`. A replay reads the order already attached to the completed draft rather than creating another order. The Shopify app installation needs `read_draft_orders,write_draft_orders` for this path.

When the flag is false, the proven `sourceIdentifier` lookup plus `orderCreate` path remains unchanged. When the flag is true, Razorpay orders created before the feature was enabled and therefore lacking `shopify_draft_order_id` also use the legacy path so an in-flight paid checkout is not stranded during deployment. If Razorpay order creation fails before an order ID is returned, the newly-created draft is deleted on a best-effort basis. Keep the flag false until each deployment is ready for a controlled low-value transaction.

Magic Checkout must also be enabled on the Razorpay account. In the Razorpay Dashboard, keep Shiprocket connected and selected in Shipping Setup; Razorpay then obtains pincode serviceability, shipping fees, COD availability, and COD fees from that dashboard integration. Do not configure a custom Shipping Info API URL at the same time. The signed browser callback at `/api/checkout/razorpay/verify` is the sole prepaid Shopify-order writer. The webhook endpoint acknowledges `payment.captured` and `order.paid` without writing, preventing those events from racing the browser callback and creating duplicate Shopify orders. The legacy `order.placed` COD webhook path is unchanged but must not be enabled until COD event support is revalidated. Coupons are deliberately hidden (`show_coupons: false`) until real promotion lookup and apply rules are implemented. All secrets must remain server-only.

## Razorpay steps 1-9

1. Enable Magic Checkout in the Razorpay account. Keep Shiprocket connected and serviceability enabled in Shipping Setup. If COD is enabled there, subscribe the payment webhook to `order.placed` before accepting COD orders.
2. Leave the custom Shipping Info API URL unset while Shiprocket is the selected shipping service. Promotion URLs are intentionally not configured while coupons are disabled.
3. `/api/checkout/razorpay/order` creates the server-side Razorpay order with authoritative Shopify prices, `line_items_total`, line items and a reconciliation snapshot.
4. Razorpay's Shiprocket connection supplies serviceability, shipping charges, COD availability, and COD fees; the storefront does not duplicate that decision in an API route.
5. Get/Apply Promotions APIs are not applicable while `show_coupons` is `false`. Implement both endpoints and their real business rules before enabling coupons.
6. `razorpay.client.ts` loads the created `order_id` into `magic-checkout.js` with `one_click_checkout: true`, a handler, and payment failure handling. Prefill is omitted because this storefront does not collect verified contact details before checkout.
7. `/api/checkout/razorpay/verify` binds the returned order to the server session and verifies the HMAC-SHA256 signature with the server-only key secret.
8. Verification fetches the Razorpay order/payment and requires the final prepaid state (`paid` order plus `captured` payment) before creating or completing a Shopify order. Prepaid webhook events are acknowledgement-only.
9. With the Draft Order flag enabled, reconciliation validates the server-authored draft anchor, updates it from the verified Razorpay result, checks its recalculated INR total, and completes it. With the flag disabled or an older in-flight Razorpay order, `sourceIdentifier` lookup plus `orderCreate` remains the fallback. In-flight coalescing protects same-worker browser retries, while Shopify's one-order-per-draft relationship protects completion replays across workers.

Dashboard enablement, public URL reachability, webhook subscriptions and test/live key mode cannot be proven by repository tests; verify them in each deployed environment.

Vendor-neutral validation is in `../../checkout.ts`; browser dispatch is in `../../checkout.client.ts`. Product and cart components must use those modules instead of importing this provider directly.
