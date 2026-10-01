# Razorpay checkout hardening roadmap

## Purpose

This document defines how to recover the useful engineering improvements from PR #35 without changing the currently working Razorpay prepaid checkout transaction.

Each improvement must be implemented in a separate pull request, deployed independently, and validated with a real low-value payment before the next pull request begins.

Do not cherry-pick PR #35 as a whole. It mixed operational hardening, rate limiting, observability, COD, webhook ownership, status polling, session handling, cart clearing and success-page UX in one release. That made failures difficult to isolate and changed the definition of a completed checkout.

## Current production baseline

The current prepaid flow is the baseline that every pull request must preserve:

```text
Create Razorpay order on the server
  -> save the Razorpay order ID in the server session
  -> open Razorpay Magic Checkout
  -> receive order ID, payment ID and signature in the browser handler
  -> POST them to /api/checkout/razorpay/verify
  -> require the returned order ID to match the session order ID
  -> verify the Razorpay signature with the server-only key secret
  -> fetch the Razorpay order and payment
  -> retry only while paid/captured state is still propagating
  -> validate status, amount, currency and checkout snapshot
  -> look up Shopify by Razorpay sourceIdentifier
  -> create the Shopify order if it does not exist
  -> require a real Shopify order ID and order name
  -> store the confirmation in the session
  -> redirect to /checkout/razorpay/success
```

The required completion invariant is:

> A prepaid checkout is not successful until the server has a real Shopify order ID and order name.

The success page must never display confirmation based only on a Razorpay payment ID.

## Current webhook and event behavior

### Prepaid checkout

The current code does **not** use either `payment.captured` or `order.paid` as a Shopify-order writer.

| Signal | Current behavior |
|---|---|
| Browser `/api/checkout/razorpay/verify` | Sole prepaid Shopify-order writer |
| Fetched Razorpay payment state | Must be `status=captured` and `captured=true` |
| `payment.captured` webhook | Signature is validated, then the event is acknowledged without writing |
| `order.paid` webhook | Signature is validated, then the event is acknowledged without writing |
| `payment.failed` webhook | Not a reconciliation event; currently acknowledged without writing |

This distinction is important: the code checks for a **captured payment state**, but it does not use the `payment.captured` webhook event to create the Shopify order.

### COD checkout

The only event currently present in `RAZORPAY_RECONCILIATION_EVENTS` is:

```text
order.placed
```

That is a legacy COD reconciliation path. COD is currently disabled and this path must not be enabled in production until the actual account exposes the event and its live/test payload has been captured and contract-tested.

Current Razorpay Magic Checkout documentation lists both `order.placed` and `payment.pending` for COD-related processing. Dashboard availability for this specific Razorpay account must be treated as authoritative before selecting either event.

## Non-negotiable checkout invariants

Every pull request in this roadmap must preserve all of these invariants:

1. The server creates the Razorpay order using Shopify-authoritative prices.
2. The payment signature is verified with the session-bound Razorpay order ID.
3. A prepaid order is fulfilled only after the payment is confirmed captured.
4. Exactly one component owns prepaid Shopify order creation.
5. The success response contains a real Shopify order ID and order name.
6. The cart and checkout session are not cleared before Shopify order creation succeeds.
7. A transient Razorpay final-state delay is retried for a short bounded period.
8. Permanent authentication, schema and data-validation failures are not retried as payment delays.
9. Replaying the browser verification request must not create another Shopify order.
10. Webhook delivery, delay or absence must not break the current prepaid browser flow.
11. FastRR files and behavior must remain isolated and unchanged.
12. COD must remain disabled unless a pull request explicitly covers COD and passes its own live validation gate.

---

# PR 1 — Operational hardening without flow changes

## Objective

Add upstream timeouts, Shopify Admin authentication reuse and configuration validation without changing which endpoint creates the Shopify order or when checkout is considered complete.

## Changes to implement

### Razorpay client timeout

- Add a 10-second timeout to Razorpay SDK HTTP calls.
- Preserve the Oxygen native-fetch adapter.
- Classify timeout failures separately from invalid payment data.
- Do not retry every Razorpay error automatically.
- Keep the existing bounded retry only for the known non-final payment/order states.

### Canonical Shopify Admin domain

- Support `SHOPIFY_ADMIN_STORE_DOMAIN` as the canonical `*.myshopify.com` domain.
- Do not send Admin API requests to the public custom storefront domain.
- Validate the domain before payment checkout can begin.

### Shopify Admin access token reuse

- Cache the client-credentials access token in the worker while it remains valid.
- Keep a safety buffer of at least 60 seconds before token expiry.
- Coalesce simultaneous token requests inside one worker instance.
- Never cache or log the client secret.
- On Shopify HTTP `401`, invalidate the cached token, request a fresh token and retry the GraphQL call once.
- Do not retry another time after the forced refresh fails.

### Scope validation

- When the token response provides scopes, require:

  ```text
  read_orders
  write_orders
  ```

- Treat missing required scopes as a permanent configuration failure.
- Return a safe failure code without exposing token contents.

### Shopify request timeout

- Apply a 10-second timeout to Shopify authentication and GraphQL requests.
- Keep the overall verification request bounded.

### Shopify GraphQL throttling

- Inspect GraphQL `errors`, not only the HTTP status.
- Detect `errors[].extensions.code === "THROTTLED"`.
- Read `extensions.cost.throttleStatus` when present.
- Retry a throttled lookup or creation request at most once after a calculated bounded delay.
- Do not retry mutation validation `userErrors`.

## Explicitly out of scope

- No webhook event changes.
- No status route.
- No client polling.
- No success-page redesign.
- No COD work.
- No session or cart-clearing changes.
- No change to `/verify` as the sole prepaid writer.

## Required automated tests

1. Razorpay requests use the Oxygen fetch adapter and timeout.
2. Valid test and live key IDs are accepted; malformed key IDs fail configuration.
3. The Shopify token is reused until its expiry buffer.
4. Simultaneous token requests are coalesced.
5. Shopify `401` causes exactly one token refresh and one GraphQL retry.
6. Missing `read_orders` or `write_orders` fails closed.
7. Shopify GraphQL `errors` fail the request even with HTTP `200`.
8. Shopify mutation `userErrors` fail without retry.
9. A throttled GraphQL response is retried at most once.
10. The existing successful `/verify -> Shopify order` integration test remains unchanged and passes.

## Live deployment gate

- Place one low-value prepaid order.
- Confirm `/verify` succeeds.
- Confirm exactly one Shopify order is created.
- Confirm Shiprocket receives exactly one order.
- Confirm the success page displays the Shopify order number.
- Observe for at least one normal checkout cycle before starting PR 2.

## Rollback condition

Rollback PR 1 if payment succeeds but Shopify creation becomes slower, intermittent, or absent; if token refresh loops; or if authentication calls fail despite unchanged production credentials.

---

# PR 2 — Checkout rate limiting without blocking paid customers

## Objective

Reduce automated abuse of the Razorpay order-creation endpoint without allowing the rate limiter to strand a customer after payment.

## Changes to implement

### Apply soft rate limiting to Razorpay order creation

Rate-limit:

```text
/api/checkout/razorpay/order
```

Suggested initial policy:

```text
Per IP: 10–15 attempts per minute
Per IP: use a broad daily ceiling, not 50 per day
Per session: 5 attempts per 10 minutes when practical
```

The daily IP ceiling must account for offices, shared Wi-Fi, mobile carrier NAT and other shared addresses.

### Treat Oxygen Cache as a soft limiter

- Hash the buyer IP before using it in a cache key.
- Never store the raw IP.
- Return `429` and a correct `Retry-After` header when the limit is exceeded.
- Document that Oxygen Cache writes are not atomic and may be data-center local.
- Do not present the limiter as strict billing, fraud or idempotency enforcement.
- If the cache operation itself fails, log the failure and allow checkout rather than breaking payment availability.

### Do not add a low IP limit to verification

`/api/checkout/razorpay/verify` runs after money may already have been captured. It is protected by:

- Same-origin form protection.
- Session-bound Razorpay order ID.
- Strict identifier formats.
- Razorpay HMAC signature.
- Server-side order, payment and amount validation.

The initial rate-limiting PR should therefore leave verification unchanged.

If verification abuse is later demonstrated, add an order/session-scoped limit such as 10–20 attempts per Razorpay order over 10–15 minutes, with a high IP backstop. Failure of that limiter must fail open so a paid customer is not stranded.

### Do not introduce status polling

The current synchronous prepaid flow does not require `/api/checkout/razorpay/status`.

## Explicitly out of scope

- No webhook changes.
- No verification ownership changes.
- No success-page polling.
- No COD.
- No Shopify order-creation changes.

## Required automated tests

1. The order endpoint applies both configured windows.
2. Exceeded requests return `429` with `Retry-After`.
3. Buyer IP values are hashed and never written to logs or response bodies.
4. A limiter cache failure does not prevent order creation.
5. Local development without `oxygen-buyer-ip` remains usable.
6. `/verify` remains reachable and unchanged after payment.
7. FastRR checkout is unaffected.

## Live deployment gate

- Place one normal prepaid order from production.
- Confirm Razorpay order creation, verification, Shopify creation and Shiprocket creation.
- Confirm repeated clicks before payment receive controlled errors without creating excessive Razorpay orders.
- Confirm verification is not rate-limited after payment.

## Rollback condition

Rollback PR 2 if legitimate checkout attempts return `429` or `503`, if shared-IP behavior is too aggressive, or if any paid verification request is blocked.

---

# PR 3 — End-to-end checkout observability

## Objective

Make every failure diagnosable without exposing secrets or changing checkout behavior.

## Changes to implement

### Define stable processing stages

Use stages such as:

```text
request_validation
session_binding
signature_verification
razorpay_order_fetch
razorpay_payment_fetch
razorpay_final_state
shopify_authentication
shopify_existing_order_lookup
shopify_order_create
session_confirmation
cart_clear
```

### Define safe failure codes

Examples:

```text
INVALID_VERIFICATION_REQUEST
RAZORPAY_SIGNATURE_INVALID
RAZORPAY_AUTHENTICATION_FAILED
RAZORPAY_PAYMENT_NOT_FINAL
RAZORPAY_ORDER_DATA_INVALID
RAZORPAY_PROVIDER_UNAVAILABLE
SHOPIFY_AUTHENTICATION_FAILED
SHOPIFY_REQUIRED_SCOPE_MISSING
SHOPIFY_GRAPHQL_THROTTLED
SHOPIFY_ORDER_REJECTED
SHOPIFY_ORDER_WRITE_FAILED
CHECKOUT_VERIFICATION_FAILED
```

### Structured Oxygen logging

Every server failure should include only:

- Log level.
- Component/scope.
- Processing stage.
- Safe failure code.
- Request ID.
- HTTP/upstream status when safe.
- Event type when applicable.
- A hashed or shortened correlation value when required.

Never log:

- Razorpay key secret.
- Shopify client secret or access token.
- Razorpay signature.
- Full request bodies.
- Shipping or billing addresses.
- Customer email or phone number.
- Full upstream error text that may contain sensitive values.

### Request correlation

- Preserve `X-Request-Id` in every response.
- Include the request ID in Oxygen and monitoring events.
- Display or record the request ID with operational errors so support can find the corresponding server log.

### Metrics

Track at least:

```text
razorpay.order.created
razorpay.verify.started
razorpay.verify.succeeded
razorpay.verify.failed by stage/code
razorpay.finalization.retry
shopify.existing_order.found
shopify.order.created
shopify.order.failed
razorpay.webhook.received by event
razorpay.webhook.invalid_signature
```

### Alerting

Alert when:

- Captured Razorpay payments have no Shopify order after the defined recovery window.
- Verification `5xx` rises above the normal baseline.
- Shopify authentication or scope failures occur.
- A webhook repeatedly returns `5xx`.

## Explicitly out of scope

- Do not change response success criteria.
- Do not add webhook writers.
- Do not add polling.
- Do not clear the cart earlier.
- Do not return secrets or raw provider errors to the browser.

## Required automated tests

1. Every failure stage returns the expected safe code.
2. Logs contain the request ID and safe stage.
3. Logs do not contain signatures, secrets, tokens, addresses, email or phone values.
4. Monitoring failures cannot change the checkout response.
5. Successful checkout behavior and response shape remain compatible with the client.

## Live deployment gate

- Complete one successful low-value payment and find all expected stage/metric records.
- Trigger one safe pre-payment invalid request and confirm its log can be located by request ID.
- Confirm Shopify developer logs and Oxygen logs can be correlated.

## Rollback condition

Rollback PR 3 if logging changes expose sensitive data, monitoring affects request success, or response changes break the checkout client.

---

# PR 4 — Success-page UX only after confirmed Shopify creation

## Objective

Reuse the visual improvements from PR #35 without reintroducing nullable orders, background polling or premature success.

## Loader contract

The success-page loader must require a session object containing:

```text
razorpayOrderId: string
shopifyOrderId: string
shopifyOrderName: string
```

If the Shopify order ID or name is absent, redirect to a safe recovery/error route. Do not render an order-confirmed page.

## UI behavior

- Display the Shopify order name, such as `#1012`, as the primary order reference.
- The Razorpay order and payment IDs may be stored for support but should not replace the Shopify order number shown to the customer.
- State clearly that payment is verified and the Shopify order is confirmed.
- Include links to return home, browse teas and contact support.
- Keep `Cache-Control: no-store, private`.
- Make the confirmation card accessible with a useful heading and `aria-live` only where necessary.

## Session behavior

- `/verify` sets success-session data only after Shopify returns the order.
- The success loader consumes and clears that confirmation once it has validated all required fields.
- Refresh behavior must be decided explicitly: either allow one safe refresh with a short-lived confirmation token or redirect after consumption.

## Cart behavior

- Clear the cart only after Shopify order creation succeeds.
- Cart-clearing failure must not turn an already-created order into a payment failure.
- Log cart-clearing failure separately.

## Prohibited behavior

- No `Confirming…` state for prepaid checkout.
- No success-page polling.
- No `/api/checkout/razorpay/status` dependency.
- No success message based on payment verification alone.
- No nullable Shopify order ID.
- No COD copy while COD remains disabled.
- No changes to verification, webhooks or order creation in the UX PR.

## Required automated tests

1. A valid confirmation renders the Shopify order number.
2. Missing Shopify order ID redirects instead of showing success.
3. Missing Shopify order name redirects instead of showing success.
4. Response headers prevent caching.
5. The loader never calls Razorpay or Shopify.
6. No polling timers or status API calls exist.
7. Mobile and desktop visual checks pass.
8. Keyboard navigation and screen-reader labels are correct.

## Live deployment gate

- Place one low-value prepaid order.
- Confirm the displayed number matches Shopify Admin.
- Refresh once and verify the intended refresh behavior.
- Confirm the cart is cleared only after order creation.
- Confirm no status polling appears in the browser network log.

## Rollback condition

Rollback PR 4 if the page can show success without a Shopify order, displays the Razorpay order ID as the merchant order number, loops, polls, or redirects valid customers incorrectly.

---

# PR 5 — Durable webhook recovery and future COD

## Objective

Add recovery for customers who close the browser after payment, without recreating the duplicate-order race.

This is a separate architecture project. Do not begin it until PRs 1–4 are stable in production.

## Mandatory prerequisite: durable atomic idempotency

Before allowing both browser callbacks and webhooks to initiate reconciliation, introduce a durable record keyed by:

```text
razorpay_order_id
```

The store must support an atomic create/claim or compare-and-set operation. Oxygen Cache and an in-memory `Map` are not sufficient.

Suggested state model:

```text
received
processing
shopify_created
completed
retryable_failure
permanent_failure
```

Persist at least:

- Razorpay order ID.
- Razorpay payment ID for prepaid checkout.
- Reconciliation status.
- Shopify order ID and order name.
- Attempt count.
- Last safe failure code.
- Created and updated timestamps.
- Processed Razorpay event IDs when available.

Do not store secrets or full customer payloads in the idempotency record.

## One reconciliation command

The browser callback and webhook must call the same server-side command:

```text
reconcileRazorpayOrder(razorpay_order_id)
```

That command must atomically claim the record before Shopify creation. Only the owner of the claim may call `orderCreate`. Other callers must read or wait for the durable result.

## Prepaid webhook policy

For Magic Checkout prepaid recovery:

- Use `order.paid` as the canonical completion event after confirming live delivery on the account.
- Keep `payment.captured` for monitoring or as a deliberately designed fallback, not as an independent uncoordinated writer.
- Verify every webhook using the raw request body and `RAZORPAY_WEBHOOK_SECRET`.
- Store and deduplicate `x-razorpay-event-id` in the durable store when available.
- Fetch the Razorpay order/payment server-side; do not trust webhook payload values as the final authority.
- Treat webhook delivery as at-least-once and potentially out of order.

Razorpay currently documents `order.paid` as the prepaid Magic Checkout completion event and `payment.captured` as the captured-payment event. Dashboard availability and actual live payloads must be verified before enabling the writer.

## Browser behavior after durable recovery exists

- The browser continues immediate signature and API verification for fast customer feedback.
- It invokes the same durable reconciliation command used by the webhook.
- It returns success only when the durable record contains the Shopify order ID.
- A short `202 Processing` response may be introduced only with a single bounded status mechanism and explicit recovery UX.
- Do not poll simultaneously from the checkout client and success page.

## COD policy

COD remains disabled until all of these conditions are satisfied:

1. Razorpay Dashboard enables COD for the production account.
2. Shiprocket remains the selected shipping provider.
3. The Dashboard exposes the required COD webhook event.
4. Real test/live payloads for `order.placed` and/or `payment.pending` are captured.
5. The payload-to-order mapping is contract-tested.
6. COD creates a Shopify order with pending financial status and no prepaid transaction.
7. Duplicate deliveries create only one Shopify order.
8. A COD cancellation/expiry policy is defined.

Do not infer COD readiness merely because an event is listed in general documentation.

## Rollout phases

### Phase A — shadow mode

- Receive and verify webhooks.
- Persist event metadata and compare expected reconciliation outcomes.
- Do not allow webhooks to create Shopify orders.
- Run for enough real prepaid transactions to confirm delivery reliability.

### Phase B — recovery-only mode

- Browser `/verify` remains the normal writer.
- Webhook reconciliation runs only when the durable record has no completed Shopify order after a defined delay.
- Both paths use the atomic claim.

### Phase C — canonical webhook mode, optional

- Consider making `order.paid` primary only after recovery-only mode proves reliable.
- Browser verification still uses the same durable command for immediate confirmation.
- Keep a rollback flag that restores browser-primary behavior without a code rollback.

## Required automated tests

1. Two concurrent reconciliation calls result in one Shopify mutation.
2. Browser callback and `order.paid` arriving simultaneously create one order.
3. Duplicate webhook event IDs are acknowledged without reprocessing.
4. Different event IDs for the same Razorpay order still create one order.
5. A worker restart does not lose idempotency state.
6. A failed Shopify mutation can be retried according to its safe failure classification.
7. A permanent Shopify validation error is not retried indefinitely.
8. Webhooks with invalid signatures never reach reconciliation.
9. Webhook delivery order does not affect the final result.
10. Closing the browser after captured payment still results in one Shopify order.
11. If COD is added, duplicate COD events still create one pending Shopify order.

## Live deployment gate

- Confirm webhook delivery in Razorpay's live dashboard.
- Confirm one browser-open payment creates one Shopify order.
- Confirm one browser-closed payment is recovered into one Shopify order.
- Replay the webhook and confirm no duplicate.
- Send browser and webhook reconciliation concurrently and confirm no duplicate.
- Confirm Shiprocket receives one order in every successful scenario.

## Rollback condition

Disable the webhook writer immediately if any paid payment lacks a Shopify order, any Razorpay order creates more than one Shopify order, webhook retries rise unexpectedly, or the durable idempotency record disagrees with Shopify.

---

# Pull-request sequencing and release rules

Use this exact order:

```text
PR 1: Operational hardening
  -> deploy
  -> real payment test
  -> observation period

PR 2: Rate limiting
  -> deploy
  -> real payment test
  -> abuse/false-positive test

PR 3: Observability
  -> deploy
  -> successful and controlled-failure tests

PR 4: Success-page UX
  -> deploy
  -> desktop/mobile/payment test

PR 5: Durable webhook recovery and COD
  -> design review
  -> durable-store test
  -> shadow mode
  -> recovery-only mode
  -> optional canonical-webhook mode
```

Every PR must:

1. Start from the currently deployed and proven version.
2. State which checkout invariants it touches.
3. Include a compact diff focused on one concern.
4. Include unit and integration tests for the changed boundary.
5. Pass lint, typecheck, unit tests, integration tests and production build.
6. Be deployed independently.
7. Pass one real low-value prepaid transaction.
8. Confirm exactly one Shopify and Shiprocket order.
9. Define a rollback condition before merge.
10. Stop the sequence immediately if a regression appears.

## Required end-to-end regression matrix

Run this matrix after every PR:

| Scenario | Expected result |
|---|---|
| Normal captured payment | One Shopify order and one Shiprocket order |
| Razorpay final state delayed briefly | Bounded retry, then one Shopify order |
| Browser verification replayed | Existing Shopify order returned; no duplicate |
| `payment.captured` webhook replayed | Acknowledged; no Shopify write in the current architecture |
| `order.paid` webhook replayed | Acknowledged; no Shopify write in the current architecture |
| Invalid Razorpay signature | Rejected; no Shopify call |
| Session order ID mismatch | Rejected; no Shopify call |
| Shopify mutation `userErrors` | Failure returned; no false success page |
| Shopify HTTP/GraphQL failure | Safe failure; session/cart retained for recovery |
| Cart-clear failure after Shopify success | Order remains successful; failure logged separately |
| FastRR feature enabled instead | Razorpay routes unavailable; FastRR behavior unchanged |

## Reference documentation

- Razorpay Magic Checkout web integration: https://razorpay.com/docs/payments/magic-checkout/web
- Razorpay Node SDK: https://github.com/razorpay/razorpay-node
- Shopify `orderCreate`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderCreate
- Shopify Admin GraphQL rate limits: https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits

