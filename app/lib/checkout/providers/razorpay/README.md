# Razorpay Magic Checkout provider

This folder contains all Razorpay-specific checkout code and configuration.

- `razorpay.ts` contains SSR-safe validation and Magic Checkout order payload construction.
- `razorpay.client.ts` creates an order through the storefront, opens `magic-checkout.js`, and submits the payment result for server verification.
- `razorpay.server.ts` is the only module that imports the official `razorpay` Node SDK. It creates orders and verifies payment signatures without exposing the key secret.
- `razorpay-order.server.ts` fetches and validates the final Razorpay order/payment, then idempotently creates the matching Shopify order through Admin GraphQL.
- `razorpay.config.ts` owns the Magic Checkout script URL and CSP sources.

Set `CHECKOUT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_CLIENT_ID`, and `SHOPIFY_ADMIN_CLIENT_SECRET` to enable this provider. The Shopify app installation needs `read_orders,write_orders`. `RAZORPAY_BUSINESS_NAME` is optional and defaults to `Charaideo Reserves`.

Set `RAZORPAY_SHIPPING_FEE_PAISE` explicitly, including `0` for free shipping. COD is off by default; enable it with `RAZORPAY_COD_ENABLED=true` and optionally set `RAZORPAY_COD_FEE_PAISE`.

Magic Checkout must also be enabled on the Razorpay account. In the Razorpay Dashboard, configure the custom e-commerce platform's Shipping Info URL as `/api/checkout/razorpay/shipping`. Configure `/webhooks/razorpay` with a dedicated secret and the `payment.captured`, `order.paid`, and `order.placed` events. Coupons are deliberately hidden (`show_coupons: false`) until real promotion lookup and apply rules are implemented. All secrets must remain server-only.

Vendor-neutral validation is in `../../checkout.ts`; browser dispatch is in `../../checkout.client.ts`. Product and cart components must use those modules instead of importing this provider directly.
