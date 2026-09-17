# Charaideo Reserves Hydrogen storefront

This repository contains the customer-facing Hydrogen storefront. Products are
loaded through Shopify's Storefront API, and cart operations use Hydrogen's cart
handler. The Razorpay branch uses Magic Checkout for payment and address collection.

## Razorpay Magic Checkout test branch

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as server-side Oxygen secrets.
For a new Shopify Dev Dashboard app in the same organization as the store,
also set `SHOPIFY_ADMIN_CLIENT_ID` and `SHOPIFY_ADMIN_CLIENT_SECRET`; the server
exchanges these for a short-lived Admin API token. A legacy admin-created custom
app can instead use `SHOPIFY_ADMIN_API_TOKEN`. This is distinct from Hydrogen's
`PRIVATE_STOREFRONT_API_TOKEN`. The app needs `write_draft_orders`,
`read_orders`, and `read_products` (the draft response includes variant details),
plus permission to mark drafts paid. After adding scopes in the Dev Dashboard,
release a new app version and approve the added access on the installed store;
then redeploy Oxygen to refresh the cached Admin token. Keep this branch on Razorpay test keys until a full test order has
been reconciled in Shopify Admin. `RAZORPAY_WEBHOOK_SECRET` is only needed when
a public webhook receiver is available; private PR testing uses the checkout
callback, which verifies the Razorpay signature and payment/order status on the
server before synchronizing Shopify. The webhook URL is
`https://<public-storefront>/webhooks/razorpay-test` with `payment.captured` and
`payment.pending` enabled in Razorpay Test Mode. Do not register a private Oxygen
preview URL as a webhook; Razorpay cannot authenticate to it.
`RAZORPAY_CUSTOM_SHIPPING_READY` defaults to false and keeps both purchase
buttons disabled until shipping and COD are configured and verified for this
custom platform integration.

Cart and Buy now create a Shopify draft from server-side product data, then a
Razorpay order with Magic Checkout line items. Razorpay's script loads only when
checkout is opened. After checkout, the server verifies the signature, fetches
the Razorpay order and payment, and completes the Shopify draft only when the
payment is captured or a COD order is placed. The signed webhook retries the
same synchronization if the browser callback is lost. Applied cart discount
codes and gift cards are rejected until their totals can be reconciled in this
custom checkout.

Razorpay's custom ecommerce documentation describes a public shipping-info API
when Shipping Service type is API. This merchant account also shows a Shiprocket
shipping option under Custom E-Commerce Platform, with dashboard-managed
serviceability and shipping/COD fees. Connect and configure that option, then
verify with a real Test Mode order whether it removes the shipping API requirement.
The Shiprocket logistics connection is separate from the removed Fastrr checkout.
Also verify COD status, shipping/tax totals, inventory, and duplicate webhook
behavior with actual Test Mode orders; local tests cannot verify those systems.

## Checkout policy

Only ordinary Shopify products can be purchased. The former custom tea blend
builder and its Draft Order checkout endpoint are retired:

- `/blends` redirects to `/collections/all`.
- `/api/blend-checkout` returns `410 Gone` and cannot create a Draft Order.
- `/api/admin/teas` returns `404 Not Found`; it must not be re-enabled without
  Shopify session-token authentication and server-side authorization.

The custom Shopify `orders/create` subscription and all custom inventory
mutations remain removed. Its temporary signed no-op route only acknowledges
deliveries already in flight. Magic Checkout uses a separate narrowly scoped
draft order flow and leaves Shopify as the inventory source.

## Local development

Copy `.env.example` to `.env`, use development-store credentials, and run:

```powershell
npm install
npm run dev
```

Never commit `.env` or expose private Storefront/Admin credentials through a
`PUBLIC_` browser variable.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

Before production, complete the prioritized checklist in
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).
