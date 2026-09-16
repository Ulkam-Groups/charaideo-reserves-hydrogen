# Changelog

Security, checkout, and production-readiness changes are recorded here. Dates
are review dates, not proof of deployment.

## 2026-09-13 - Storefront security hardening

### Security

- Removed all Shopify Admin API scopes. The storefront now uses Storefront and
  Customer Account APIs only.
- Added allowlist sanitization for Shopify product descriptions, pages,
  policies, and articles. Active content, unsafe URLs, and untrusted iframes are
  removed before rendering.
- Added HSTS on HTTPS, `X-Content-Type-Options`, `Referrer-Policy`, and
  `Permissions-Policy` without replacing the nonce-based CSP.
- Made the signed session cookie `Secure` in production.
- Added request IDs and structured, redacted server/SSR errors.
- Replaced customer-visible internal exceptions with stable messages.
- Bounded cart permalinks, quantities, variant IDs, discounts, search terms,
  and predictive-search result counts.

### Shopify integration

- Added Hydrogen `Analytics.Provider`, `getShopAnalytics`, Customer Privacy API
  consent configuration, and Shopify's privacy banner.
- Retained `PUBLIC_CHECKOUT_DOMAIN` for Shopify-hosted checkout, CSP, analytics,
  and consent.
- Removed the obsolete manual `/api/:version/graphql.json` route. Hydrogen's
  request handler provides the supported same-origin Storefront API proxy.
- Awaited Customer Account authentication status on all affected routes.
- Preserved standard Shopify product/cart/hosted checkout as the only active
  commerce flow.

### Reliability and performance

- Kept Judge.me reviews asynchronous and below the critical render path.
- Added concurrent-request coalescing, Oxygen caching, a 15-minute positive
  cache, a one-minute empty/failure cache, and a one-page fallback limit.
- Added regression tests for analytics, auth, input bounds, sanitization,
  headers, scope removal, proxy retirement, and Judge.me call limits.

## 2026-09-13 - Custom blend retirement

- Removed the client-controlled blend pricing engine and builder.
- Removed Draft Order creation and its Admin API helper.
- Retired `/api/blend-checkout` with `410 Gone` and redirected `/blends` to the
  Shopify catalog.
- Disabled `/api/admin/teas` with a non-disclosing `404` and removed the shared
  bearer-token design.
- Added same-store validation for cart and discount return paths.
- Removed the `orders/create` subscription and inventory mutation.
- Reduced the transitional order webhook to a signed, size-bounded,
  no-side-effect acknowledgement for already-in-flight deliveries.
- Added regression tests for retired routes, webhook verification, absence of
  webhook network calls, and safe redirects.
- Added the prioritized `PRODUCTION_READINESS.md` backlog.

## Deferred owner decision

- Production dependency upgrades and advisory remediation remain intentionally
  deferred. Release audits must continue to report this risk until affected
  packages are upgraded and retested.
