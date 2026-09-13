# Charaideo Reserves Hydrogen storefront

This repository contains the customer-facing Hydrogen storefront. Products are
loaded through Shopify's Storefront API, cart operations use Hydrogen's cart
handler, and customers complete payment through the standard Shopify-hosted
checkout.

## Checkout policy

Only ordinary Shopify products can be purchased. The former custom tea blend
builder and Draft Order checkout endpoint are retired:

- `/blends` redirects to `/collections/all`.
- `/api/blend-checkout` returns `410 Gone` and cannot create a Draft Order.
- `/api/admin/teas` returns `404 Not Found`; it must not be re-enabled without
  Shopify session-token authentication and server-side authorization.

The custom `orders/create` subscription and all custom inventory mutations are
removed. A temporary signed no-op route remains only to acknowledge deliveries
that were already in flight when the subscription was retired; Shopify remains
the sole source of ordinary product inventory changes.

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
