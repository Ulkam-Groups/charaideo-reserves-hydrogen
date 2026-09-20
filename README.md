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

## Homepage chapter inventory reveal

The homepage reads the Shopify collections titled `Chapter I`, `Chapter II`,
and `Chapter III`. Publish those collections and their products to the Hydrogen
storefront. A chapter stays sealed or Coming Soon while every product in its
collection has zero or unknown `totalInventory`. When any product has positive
inventory, the chapter card opens and links to `/collections/<handle>`. Clicking
the sealed Chapter I card opens its waitlist modal. Chapter I also reveals the
estate name and traceability rows from the first stocked product. Use the product
metafields `custom.estate`, `custom.flush`, `custom.grade`, `custom.pluck_date`,
and `custom.leaf` for those rows, with Storefront API read access enabled on
their definitions. Without them, the product title or “Revealed soon” appears.
The homepage checks again when the tab gains focus and every 60 seconds while
visible; new visitors get a fresh inventory check. The inventory query checks up
to 100 products per collection.

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

## Sentry monitoring

Set `SENTRY_ENABLED=true` and `SENTRY_DSN` in the Oxygen environment to the public DSN for the
`ulkam-group/javascript-react-router` project. The value is exposed to the
browser by design; do not use a Sentry auth token here. Monitoring is disabled
unless `SENTRY_ENABLED` is exactly `true` and a valid DSN is present. When disabled,
the browser does not download the Sentry SDK. Set `SENTRY_ENABLED=false` and
redeploy the Oxygen environment to pause monitoring without changing code.
The disabled flag removes Sentry collection on requests, but Oxygen still bundles
the server SDK in the worker, so it does not guarantee identical cold-start time.
The SDK sends fixed event names and bounded tags, not
request URLs, customer records, GraphQL variables, or Judge.me credentials.
Set `SENTRY_ENVIRONMENT=preview` in branch environments and
`SENTRY_ENVIRONMENT=production` in production so alerts can exclude test traffic.

The storefront emits request counts and duration by status and route group,
Storefront query latency and failures, Customer Account mutation/query failures,
Judge.me quota/timeouts, Fastrr launch results, and browser hydration errors.
Hydration events carry a page-load incident ID and safe same-origin script frames.
React #423 recovery events are suppressed when a #418 mismatch was already reported.
For readable production frames, add `SENTRY_AUTH_TOKEN` as a **GitHub Actions secret**
with permission to upload source maps to the `ulkam-group/javascript-react-router`
project. The deploy workflow passes the commit SHA as `SENTRY_RELEASE`; its build
uploads client source maps and removes the map files before Oxygen receives assets.
Keep this token out of Oxygen variables and browser code. Deployments built outside
that workflow still report errors, but may show minified frames.
In Sentry, create email alerts for `fastrr.launch.failure`,
`customer_account.mutation.failure`, `judgeme.reviews.failure` with
`reason:quota`, and `storefront.http.failure`. Use metric monitors for the
5xx/429 share of `storefront.request.count` and p95 of
`storefront.query.duration`; set thresholds after collecting baseline traffic.
The free plan's single uptime monitor can check the public storefront homepage
once it is live.

A successful Fastrr `buyDirect` call means the vendor script accepted a launch
request. It does not prove that payment completed or that an order reached
Shopify. Order reconciliation requires a Fastrr order reference and a matching
Shopify order event or feed before an alert can be truthful.

Before production, complete the prioritized checklist in
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).
