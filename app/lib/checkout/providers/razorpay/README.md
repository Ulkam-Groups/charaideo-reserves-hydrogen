# Razorpay Magic Checkout provider

This folder contains all Razorpay-specific checkout code and configuration.

- `razorpay.ts` contains SSR-safe validation and Magic Checkout order payload construction.
- `razorpay.client.ts` creates an order through the storefront, opens `magic-checkout.js`, and submits the payment result for server verification.
- `razorpay.server.ts` creates orders with the official `razorpay` SDK and verifies signatures with Oxygen's Web Crypto API without exposing the key secret.
- `razorpay-oxygen.server.ts` initializes only the official SDK's API, Orders, and Payments modules used by this storefront; the package's main class eagerly imports Node-only modules that Oxygen cannot load.
- `crypto-compat.server.ts` blocks accidental use of the SDK's Node-only crypto helpers. Payment and webhook HMAC verification remains in `razorpay.server.ts`.
- `razorpay-order.server.ts` fetches and validates the final Razorpay order/payment, then idempotently creates the matching Shopify order through Admin GraphQL.
- `razorpay.config.ts` owns the Magic Checkout script URL and CSP sources.

Set `CHECKOUT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_CLIENT_ID`, and `SHOPIFY_ADMIN_CLIENT_SECRET` to enable this provider. Set `SHOPIFY_ADMIN_STORE_DOMAIN` to the shop's canonical `*.myshopify.com` domain when `PUBLIC_STORE_DOMAIN` points elsewhere; otherwise the public domain is used. The Shopify app installation needs `read_orders,write_orders`. `RAZORPAY_BUSINESS_NAME` is optional and defaults to `Charaideo Reserves`.

Magic Checkout must also be enabled on the Razorpay account. In the Razorpay Dashboard, keep Shiprocket connected and selected in Shipping Setup; Razorpay then obtains pincode serviceability, shipping fees, COD availability, and COD fees from that dashboard integration. Do not configure a custom Shipping Info API URL at the same time. Configure `/webhooks/razorpay` with a dedicated secret and the `payment.captured`, `order.paid`, and `order.placed` events. The first two reconcile prepaid orders; `order.placed` is required to reconcile COD orders. Coupons are deliberately hidden (`show_coupons: false`) until real promotion lookup and apply rules are implemented. All secrets must remain server-only.

## Razorpay steps 1-9

1. Enable Magic Checkout in the Razorpay account. Keep Shiprocket connected and serviceability enabled in Shipping Setup. If COD is enabled there, subscribe the payment webhook to `order.placed` before accepting COD orders.
2. Leave the custom Shipping Info API URL unset while Shiprocket is the selected shipping service. Promotion URLs are intentionally not configured while coupons are disabled.
3. `/api/checkout/razorpay/order` creates the server-side Razorpay order with authoritative Shopify prices, `line_items_total`, line items and a reconciliation snapshot.
4. Razorpay's Shiprocket connection supplies serviceability, shipping charges, COD availability, and COD fees; the storefront does not duplicate that decision in an API route.
5. Get/Apply Promotions APIs are not applicable while `show_coupons` is `false`. Implement both endpoints and their real business rules before enabling coupons.
6. `razorpay.client.ts` loads the created `order_id` into `magic-checkout.js` with `one_click_checkout: true`, a handler, and payment failure handling. Prefill is omitted because this storefront does not collect verified contact details before checkout.
7. `/api/checkout/razorpay/verify` binds the returned order to the server session and verifies the HMAC-SHA256 signature with the server-only key secret.
8. Verification and signed webhooks fetch the Razorpay order/payment and require the final prepaid state (`paid` order plus `captured` payment) before creating a Shopify order.
9. Reconciliation fetches the final order details, validates totals and address data, and creates the Shopify order through Admin GraphQL. `sourceIdentifier` lookup plus in-flight coalescing makes retries safe.

Dashboard enablement, public URL reachability, webhook subscriptions and test/live key mode cannot be proven by repository tests; verify them in each deployed environment.

Vendor-neutral validation is in `../../checkout.ts`; browser dispatch is in `../../checkout.client.ts`. Product and cart components must use those modules instead of importing this provider directly.
