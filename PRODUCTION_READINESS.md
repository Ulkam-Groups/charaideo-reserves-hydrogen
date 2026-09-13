# Production readiness and security backlog

Reviewed: 2026-09-13

This is the prioritized release checklist for the Charaideo Reserves Hydrogen
storefront. A checked local control is not proof that its production deployment
or Shopify Admin configuration has been verified.

## Current security disposition

Implemented and locally verified:

- [x] Removed the client-priced custom blend flow, Draft Order creation, Admin
  helper, and custom inventory mutation.
- [x] `/blends` redirects to the catalog; `/api/blend-checkout` is `410` and
  `/api/admin/teas` is a non-disclosing `404`.
- [x] Cart and discount return paths accept only same-store redirects.
- [x] Removed the configured `orders/create` subscription. The transitional
  endpoint verifies raw-body HMAC, limits the body to one megabyte, and cannot
  make API writes.
- [x] Removed all Admin API scopes. This storefront uses Storefront and Customer
  Account APIs only.
- [x] Added Hydrogen analytics, Shopify consent integration, and the privacy
  banner. `PUBLIC_CHECKOUT_DOMAIN` remains the Shopify-hosted checkout domain
  and is also used for CSP and consent.
- [x] Awaited Customer Account auth status on profile, address, and account
  fallback routes.
- [x] Removed the redundant manual Storefront API proxy. Hydrogen's
  `createRequestHandler` supplies the supported same-origin proxy.
- [x] Bounded and validated cart-permalink and predictive-search inputs.
- [x] Allowlist-sanitized Shopify-authored product, page, policy, and article
  HTML before browser rendering.
- [x] Added HSTS on HTTPS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, production-secure sessions, request IDs, and redacted
  server errors.
- [x] Kept Judge.me below the critical render path and added request coalescing,
  Oxygen caching, short negative caching, and a one-page fallback limit.
- [x] Added regression coverage for these controls.

Explicitly deferred by the owner:

- [ ] Dependency remediation. The 2026-09-13 audit snapshot reported 12
  production-tree advisories, including three high-severity findings.

## P0 - required before production traffic

### Secrets

- [ ] Rotate every production-looking token and secret and revoke each old
  value. Keep production values only in Oxygen environment variables.
- [ ] Confirm no secret exists in Git history, build artifacts, browser code,
  logs, screenshots, or support tickets.
- [ ] Generate `SESSION_SECRET` independently with at least 32 random bytes.

### Dependencies

- [ ] Resolve or explicitly time-bound the accepted high-severity dependency
  risk.
- [ ] Run `npm audit --omit=dev` against the exact release lockfile and attach
  the result to release sign-off.
- [ ] Document exploitability and compensating controls for each residual
  advisory.

### Shopify checkout and environment

- [ ] Verify production store/checkout domains, Storefront tokens/ID, Customer
  Account configuration, and privacy-banner regions in Shopify Admin/Oxygen.
- [ ] Run a development-store product -> cart -> Shopify-hosted checkout test
  covering quantity, inventory, discounts, gift cards if enabled, market,
  taxes, shipping, test payment, cancellation, and sold-out behavior.
- [ ] Confirm totals and inventory come only from Shopify product/variant data.
- [ ] Verify checkout and analytics cookies persist across storefront and
  checkout domains.

### Webhook retirement

- [ ] Confirm the deployed Shopify configuration has no `orders/create`
  subscription.
- [ ] After confirming no in-flight deliveries, delete the transitional route
  and remove `SHOPIFY_WEBHOOK_SECRET` from every environment.
- [ ] Reconcile or close any historical custom-blend Draft Orders manually.

This is a store-owned Hydrogen storefront, not an app distributed through the
Shopify App Store. App Store compliance webhooks (`customers/data_request`,
`customers/redact`, and `shop/redact`) are therefore not required. Reassess and
implement them before any future public-app distribution.

## P1 - automated release and operational gates

### CI and regression prevention

- [ ] Add CI jobs for formatting/lint, TypeScript, unit/integration tests,
  production build, dependency audit, secret scan, and lockfile integrity.
- [ ] Make every required CI job block merge and production deployment.
- [ ] Add Playwright coverage for catalog -> PDP -> cart -> hosted checkout,
  login/logout, profile/address updates, and cart-cookie persistence.
- [ ] Test Storefront and Customer Account GraphQL partial failures (`200` with
  `errors`/`userErrors`), timeouts, and session expiry.

### Abuse controls

- [ ] Add Oxygen/edge rate limits and alerts for search, cart permalinks,
  account writes, and anomalous Judge.me traffic.
- [ ] Add strict content-type, request-size, and CSRF/origin checks to every
  future cookie-authenticated custom write endpoint.
- [ ] Verify production session and cart cookie flags on the custom domain.

### Monitoring and response

- [ ] Connect centralized error/performance monitoring and uptime checks.
- [ ] Confirm request IDs and release identifiers reach redacted persisted logs.
- [ ] Alert on checkout failures, 5xx/429 rates, Customer Account failures,
  Storefront latency, Judge.me quota/failures, and webhook retries.
- [ ] Define deployment approval, rollback, incident response, Shopify outage,
  credential rotation, recovery objectives, and support ownership.
- [ ] Back up business-owned configuration and test restoration.

## P2 - quality, performance, and maintainability gates

### Accessibility and UX

- [ ] Run automated accessibility and manual keyboard/screen-reader checks to
  WCAG 2.1 AA on all primary routes.
- [ ] Add visual regression coverage at mobile, tablet, desktop, 200% zoom,
  slow network, high contrast, and reduced motion.
- [ ] Verify loading, empty, error, offline, and partial-failure states.

### Performance

- [ ] Establish LCP, INP, CLS, server latency, error rate, bundle size, cache-hit
  ratio, and third-party call budgets; alert or fail CI on regression.
- [ ] Run coordinated load/failure tests for Shopify and Judge.me latency,
  quota exhaustion, timeouts, malformed responses, and partial API errors.
- [ ] Audit image transforms/dimensions, lazy loading, critical fonts, route
  bundles, GraphQL cost, cache policy, and deferred data boundaries.

### Markets, SEO, and lifecycle

- [ ] Replace hardcoded `EN`/`US` with an intentional India/market localization
  strategy and test currency/language behavior.
- [ ] Validate canonical URLs, metadata, structured product data, robots,
  sitemaps, redirects, and unavailable products for each market.
- [ ] Schedule quarterly dependency, scope, privacy, accessibility, and disaster
  recovery reviews.

References:

- [Hydrogen production checklist](https://shopify.dev/docs/storefronts/headless/hydrogen/production-checklist)
- [Hydrogen analytics and consent](https://shopify.dev/docs/storefronts/headless/hydrogen/analytics/consent)
- [Hydrogen CSP](https://shopify.dev/docs/storefronts/headless/hydrogen/content-security-policy)
- [Shopify access scopes](https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes)
- [Shopify webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
- [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Release sign-off record

For each deployment record the commit, Oxygen environment, Shopify store,
reviewer, test evidence, unresolved risks, rollback version, and approval date.
Every P0 item must be closed or explicitly risk-accepted in writing.
