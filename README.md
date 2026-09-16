# Charaideo Reserves Hydrogen storefront

This repository contains the customer-facing Hydrogen storefront. Products are
loaded through Shopify's Storefront API, and cart operations use Hydrogen's cart
handler. Checkout can be initiated through Shiprocket Fastrr when configured.

## Shiprocket Fastrr checkout

Set `PUBLIC_FASTRR_SELLER_DOMAIN` to the exact seller domain configured by
Shiprocket (domain only, without `https://`), in the local environment and the
deployed storefront environment. Checkout remains disabled until it is set.

When configured, the storefront loads Shiprocket's CSS on every page and its
Shopify script after React hydration to prevent third-party DOM changes from
breaking Hydrogen hydration. Cart checkout sends variant IDs, quantities, the first applicable
discount code, URL UTM parameters, and cart attributes. The product page's
Buy now action sends the selected variant with `type: 'product'`. If the vendor
script is unavailable, checkout displays an error instead of opening Shopify's
checkout URL. Carts with applied gift cards cannot proceed until the gift card
is removed, because the supplied Fastrr API has no gift card parameter. Cart
permalinks now create a cart and open `/cart` rather than redirecting to Shopify
Checkout.

Before enabling this in production, test one product and one cart order with
Shiprocket's configured seller domain and confirm the resulting Shopify orders,
discounts, and analytics. The vendor script may use additional origins that
must be added to the Content Security Policy after checking its live network
requests.

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
