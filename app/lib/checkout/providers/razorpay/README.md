# Razorpay Magic Checkout provider

This folder contains all Razorpay-specific checkout code and configuration.

The canonical production flow, invariants, rollout evidence, rollback behavior, and
regression checklist are documented in
[`docs/razorpay-checkout-architecture.md`](../../../../../docs/razorpay-checkout-architecture.md).
Read that document before changing checkout ownership, Draft Order completion, or
webhook behavior.

- `razorpay.ts` contains SSR-safe validation and Magic Checkout order payload construction.
- `razorpay.client.ts` creates an order through the storefront, opens `magic-checkout.js`, and submits the payment result for server verification.
- `razorpay.server.ts` creates orders with the official `razorpay` SDK and verifies signatures with Oxygen's Web Crypto API without exposing the key secret.
- `razorpay-oxygen.server.ts` initializes only the official SDK's API, Orders, and Payments modules used by this storefront; the package's main class eagerly imports Node-only modules that Oxygen cannot load.
- `crypto-compat.server.ts` blocks accidental use of the SDK's Node-only crypto helpers. Payment and webhook HMAC verification remains in `razorpay.server.ts`.
- `razorpay-order.server.ts` fetches and validates the final Razorpay order/payment, then either completes its anchored Shopify Draft Order or uses the legacy `orderCreate` path through Admin GraphQL.
- `razorpay.config.ts` owns the Magic Checkout script URL and CSP sources.

Set `CHECKOUT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_CLIENT_ID`, and `SHOPIFY_ADMIN_CLIENT_SECRET` to enable this provider. Set `SHOPIFY_ADMIN_STORE_DOMAIN` to the shop's canonical `*.myshopify.com` domain when `PUBLIC_STORE_DOMAIN` points elsewhere; otherwise the public domain is used. The Shopify app installation needs `read_orders,write_orders,read_draft_orders,write_draft_orders`. `RAZORPAY_BUSINESS_NAME` is optional and defaults to `Charaideo Reserves`.

PR 1 operational hardening keeps the checkout ownership and success contract unchanged.
Razorpay SDK calls and Shopify authentication/GraphQL calls have 10-second upstream
timeouts. Shopify client-credentials tokens are reused inside an Oxygen worker until
60 seconds before their reported expiry, and simultaneous token requests are
coalesced. A Shopify GraphQL `401` invalidates the cached token and permits exactly
one refresh/retry. When Shopify returns its documented `scope` field, the current
Draft Order path requires `write_orders` and `write_draft_orders`; Shopify write
scopes include the corresponding read access. Missing write capabilities fail before
GraphQL. A GraphQL `THROTTLED` error
is retried once after a delay calculated from `extensions.cost.throttleStatus`, capped
at two seconds. Mutation `userErrors` are never automatically retried. The PR 1 code
and automated gates must not be treated as Production proof until its low-value live
deployment gate is recorded.

`RAZORPAY_WEBHOOK_SHADOW_ENABLED=true` enables the read-only PR 5C observation mode for signed `order.paid` webhooks when recovery is disabled. Shadow mode validates the event contract, fetches the authoritative Razorpay order and payment, verifies the captured state and server-authored Draft Order anchor, and emits safe operational telemetry. It acknowledges the webhook without contacting Shopify. This flag is now an optional diagnostic/rollback mode; recovery takes precedence when `RAZORPAY_WEBHOOK_RECOVERY_ENABLED=true`.

`RAZORPAY_WEBHOOK_RECOVERY_ENABLED=true` enables PR 5D recovery for signed
`order.paid` webhooks. Recovery is valid only with
`RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true`. The webhook fetches the authoritative
Razorpay order and captured payment, requires the server-authored Draft Order GID,
and invokes the same `reconcileRazorpayOrder` command as browser verification. It
cannot fall back to `orderCreate`: a missing, invalid, or mismatched anchor is safely
marked ineligible without a Shopify write. The response is `204` after reconciliation
returns the Shopify order, or after a permanently ineligible legacy event; transient
failures return `500` so Razorpay can retry. Enabling recovery without the Draft Order
flag returns `503` before any external call. Duplicate or concurrent signals read
the single Order attached to the completed Draft Order instead of creating another
one. When recovery is enabled it takes precedence over shadow mode. Set it to `false`
to restore browser-only completion without a code rollback; read-only shadow
observation also resumes if its separate flag remains enabled.

PR 5D passed its Production gate on 2026-10-01 and was merged to `main`. A
browser-first payment logged `outcome=already_completed`, while a browser-closed
payment logged `outcome=completed`; both signed `order.paid` requests returned `204`
and converged on the one Shopify Order attached to the anchored Draft Order. The full
safe evidence record and request IDs are in the canonical architecture document.

`RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true` enables the Draft Order reconciliation path. Before creating the Razorpay order, the order endpoint creates an uncompleted Shopify Draft Order and stores its GID in both the Razorpay order notes (`shopify_draft_order_id`) and the server session. After a captured payment is fully validated, browser verification updates that exact draft with the verified address, shipping charge, Razorpay IDs and payment method, requires the recalculated Shopify total to equal the captured Razorpay amount, and calls `draftOrderComplete`. A replay reads the order already attached to the completed draft rather than creating another order. The Shopify app installation needs `read_draft_orders,write_draft_orders` for this path.

When the flag is false, the proven `sourceIdentifier` lookup plus `orderCreate` path remains unchanged. When the flag is true, Razorpay orders created before the feature was enabled and therefore lacking `shopify_draft_order_id` also use the legacy path so an in-flight paid checkout is not stranded during deployment. If Razorpay order creation fails before an order ID is returned, the newly-created draft is deleted on a best-effort basis. The flag-enabled path was live-tested successfully on 2026-10-01 and is the production configuration; use false only as an explicit rollback.

Magic Checkout must also be enabled on the Razorpay account. In the Razorpay Dashboard, keep Shiprocket connected and selected in Shipping Setup; Razorpay then obtains pincode serviceability, shipping fees, COD availability, and COD fees from that dashboard integration. Do not configure a custom Shipping Info API URL at the same time. With recovery disabled, the signed browser callback at `/api/checkout/razorpay/verify` remains the sole prepaid Shopify-order writer and signed webhooks cannot write. With PR 5D recovery enabled, only `order.paid` may join the browser callback as a trigger for the same anchored Draft Order command. `payment.captured` remains acknowledged without writing. The legacy `order.placed` COD webhook path is unchanged but must not be enabled until COD event support is revalidated. Coupons are deliberately hidden (`show_coupons: false`) until real promotion lookup and apply rules are implemented. All secrets must remain server-only.

## Razorpay steps 1-9

1. Enable Magic Checkout in the Razorpay account. Keep Shiprocket connected and serviceability enabled in Shipping Setup. Keep COD disabled until its actual dashboard event and payload are captured and contract-tested; do not assume `order.placed` is available.
2. Leave the custom Shipping Info API URL unset while Shiprocket is the selected shipping service. Promotion URLs are intentionally not configured while coupons are disabled.
3. `/api/checkout/razorpay/order` creates the server-side Razorpay order with authoritative Shopify prices, `line_items_total`, line items and a reconciliation snapshot.
4. Razorpay's Shiprocket connection supplies serviceability, shipping charges, COD availability, and COD fees; the storefront does not duplicate that decision in an API route.
5. Get/Apply Promotions APIs are not applicable while `show_coupons` is `false`. Implement both endpoints and their real business rules before enabling coupons.
6. `razorpay.client.ts` loads the created `order_id` into `magic-checkout.js` with `one_click_checkout: true`, a handler, and payment failure handling. Prefill is omitted because this storefront does not collect verified contact details before checkout.
7. `/api/checkout/razorpay/verify` binds the returned order to the server session and verifies the HMAC-SHA256 signature with the server-only key secret.
8. Verification fetches the Razorpay order/payment and requires the final prepaid state (`paid` order plus `captured` payment) before creating or completing a Shopify order. With recovery enabled, signed `order.paid` performs the same authoritative validation and anchored reconciliation; `payment.captured` remains acknowledgement-only.
9. With the Draft Order flag enabled, reconciliation validates the server-authored draft anchor, updates it from the verified Razorpay result, checks its recalculated INR total, and completes it. With the flag disabled or an older in-flight Razorpay order, `sourceIdentifier` lookup plus `orderCreate` remains the fallback. In-flight coalescing protects same-worker browser retries, while Shopify's one-order-per-draft relationship protects completion replays across workers.

Dashboard enablement, public URL reachability, webhook subscriptions and test/live key mode cannot be proven by repository tests; verify them in each deployed environment.

Vendor-neutral validation is in `../../checkout.ts`; browser dispatch is in `../../checkout.client.ts`. Product and cart components must use those modules instead of importing this provider directly.
