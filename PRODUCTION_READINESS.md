# Production readiness and security backlog

Reviewed: 2026-09-17 (`prodReady` branch, PR #11 targeting `main`)

This is the prioritized release checklist for the Charaideo Reserves Hydrogen
storefront intended for `main`. The experimental Razorpay branch is outside
this release checklist. A checked local control is not proof that its
production deployment or Shopify Admin configuration has been verified.

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
  banner. `PUBLIC_CHECKOUT_DOMAIN` remains configured for Shopify analytics,
  consent, and CSP; this branch initiates checkout through Shiprocket Fastrr.
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

Checkout code present on `main`, pending live verification:

- [x] Product Buy now and cart checkout call Fastrr with Shopify variant IDs.
  The seller domain gates both actions, and vendor script failures show an error.
- [ ] Verify the seller configuration, vendor script, checkout totals, and
  resulting Shopify order on the production-like deployment.

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

### Release deployment

- [ ] Verify the exact release commit passes tests, typecheck, production build,
  and the dependency decision before merging. The Oxygen workflow now gates
  push deployments on formatting/lint, TypeScript, unit/integration tests,
  storefront Playwright, and the production build; the dependency decision
  remains open.
- [ ] Confirm the target Oxygen environment, rollback deployment, and person
  responsible for authorizing the production merge.

### Shiprocket Fastrr checkout and environment

- [ ] Verify production store/checkout domains, Storefront tokens/ID, Customer
  Account configuration, privacy-banner regions, and
  `PUBLIC_FASTRR_SELLER_DOMAIN` in Shopify Admin/Oxygen and Shiprocket.
- [ ] On the exact release deployment, confirm the Fastrr CSS loads and its
  Shopify script initializes after hydration on product and cart pages. Record
  any CSP-blocked vendor origins and allow only the origins actually required.
- [ ] Test Buy now and cart checkout through Fastrr with one and multiple
  variants, quantity changes, an applicable discount code, cart attributes,
  UTM parameters, sold-out products, script failure, and an empty cart.
- [ ] Confirm gift-card carts stay blocked with a clear message until the
  vendor flow can apply their balance correctly.
- [ ] Place test prepaid and COD orders, if enabled, and reconcile product,
  discount, shipping, tax, payment status, customer details, and inventory in
  the final Shopify orders. Test cancellation and refund handling as well.
- [ ] Confirm Shopify product/variant prices and availability are authoritative
  and that the Fastrr order total matches the final Shopify order.
- [ ] Verify checkout/analytics consent and attribution across the Hydrogen,
  Shiprocket, and Shopify domains used by the actual order flow.

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

Local verification on 2026-09-17: 27 unit tests, 12 route integration tests,
and all 7 storefront Playwright tests passed (the new CSP case was rerun after
the other six); formatting/lint, TypeScript, and
the production build also passed. The browser tests use mock.shop for fictional
Storefront API products and carts. They fulfill the Fastrr script locally,
record `buyDirect` calls, and block other off-host browser requests. They do
not verify a live Fastrr checkout or a resulting Shopify order.

- [x] Add CI jobs for formatting/lint, TypeScript, unit/integration tests,
  storefront Playwright, and the production build. Formatting currently checks
  tests and test configuration; lint covers app and tests.
- [x] Require those five jobs before the workflow's Oxygen push deployment.
- [x] Add mocked Playwright coverage for catalog -> PDP -> cart -> Fastrr
  launch, cart-cookie persistence, empty cart, missing/throwing vendor script,
  quantity, and UTM parameters.
- [x] Add route integration tests for simulated Storefront and Customer Account
  GraphQL errors, `userErrors`, timeouts, and session expiry. These inject
  client results; they do not exercise actual HTTP 200 responses from Shopify.
- [ ] Add dependency audit, secret scan, and lockfile integrity CI gates.
- [ ] Configure branch protection so required checks block merging PRs. The
  workflow gates push deployments, but branch protection is separate.
- [ ] Configure and run Customer Account Playwright tests for login/logout and
  profile/address updates against a dedicated test deployment. The job is
  skipped on PR events and on pushes while `E2E_ACCOUNT_BASE_URL` is unset;
  see `tests/README.md`. A skipped job is not a passing test.
- [ ] Verify real Storefront and Customer Account HTTP 200 partial failures,
  timeouts, and session expiry in a controlled test environment.

### Abuse controls

- [ ] Add Oxygen/edge rate limits and alerts for search, cart permalinks,
  account writes, and anomalous Judge.me traffic. Implementation plan below;
  no limiter or alert service is configured yet.

#### Deferred rate-limit implementation: Upstash

- Use `@upstash/ratelimit` with `@upstash/redis` as the shared, HTTP-based
  counter store. Keep its REST URL and token in Oxygen server-only environment
  variables. Estimate command usage before enabling limits; the free-tier quota
  is measured in Redis commands, not storefront requests.
- Add a small server-side guard for the affected Hydrogen routes. Use separate
  buckets for predictive/full search, cart permalink creation and discount
  links, cart mutations, and authenticated profile/address writes. Do not
  charge ordinary page views to these buckets. Prefer customer identity for
  signed-in writes and the trusted Oxygen `oxygen-buyer-ip` header for anonymous
  requests; never trust a browser-supplied forwarding header. HMAC identifiers
  before storing them as counter keys or logging them.
- Start in observe-only mode with per-route counts, would-block counts, and
  false-positive review. Tune thresholds from actual traffic, then enforce
  with `429`, `Retry-After`, and non-cacheable responses. Define and test what
  happens when Upstash times out or is unavailable so a counter outage does
  not silently disable all protection or strand normal shoppers.
- Measure Judge.me outbound requests after existing coalescing/cache, including
  cache misses, failures, timeouts, and quota responses. Alert on unusual
  volume or failure rates; limit only a review endpoint we control if needed.
  Hydrogen cannot rate-limit browser calls made directly to Judge.me.
- Emit structured, redacted events for blocks, limiter errors, and Judge.me
  anomalies, with route, request ID, and release ID. Connect a monitoring
  destination and alert thresholds; Oxygen log drains are Shopify Plus-only.
  Test the alerts and the `429` behavior on a non-production Oxygen deployment
  before enforcement. Shopify Flow may react to later Shopify events, but it
  cannot reject incoming Hydrogen requests.
- Keep COD-order-per-IP policy separate: Fastrr completes checkout outside
  Hydrogen, so request limiting here cannot guarantee one COD order per IP.
  That rule needs a checkout/order-side control and its own reconciliation.

Do not put a proxy in front of Oxygen for this plan; Shopify does not support
that configuration. Oxygen's cache is local to its originating data center,
so it is not a reliable store-wide rate-limit counter.

- [x] Added a shared same-origin, Fetch Metadata, form content-type, and streamed
  request-size guard to the current cart, profile, address, and logout actions.
  Use `readProtectedForm` before parsing or mutating data in every future
  cookie-backed browser write action. The Shopify webhook uses HMAC instead of
  browser-origin checks. Local unit, route integration, and mocked browser
  coverage verify the existing flows; verify the same guards on the deployed
  custom domain before production traffic.
- [ ] Verify production session and cart cookie flags on the custom domain.

### Monitoring and response

- [ ] Connect centralized error/performance monitoring and uptime checks.
- [ ] Confirm request IDs and release identifiers reach redacted persisted logs.
- [ ] Alert on Fastrr launch/order reconciliation failures, 5xx/429 rates,
  Customer Account failures, Storefront latency, and Judge.me quota/failures.
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
  ratio, and third-party call budgets, including the Fastrr script; alert or
  fail CI on regression.
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
- [Oxygen runtime and buyer IP](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime)
- [Oxygen proxy limitation](https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals)
- [Oxygen log drains](https://shopify.dev/docs/storefronts/headless/hydrogen/logging)
- [Upstash rate limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)

## Release sign-off record

For each deployment record the commit, Oxygen environment, Shopify store,
reviewer, test evidence, unresolved risks, rollback version, and approval date.
Every P0 item must be closed or explicitly risk-accepted in writing.
