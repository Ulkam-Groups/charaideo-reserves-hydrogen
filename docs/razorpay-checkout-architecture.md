# Razorpay Magic Checkout architecture

## Status and authority

This is the canonical description of the production Razorpay prepaid checkout. Read
this document before changing checkout ownership, Shopify order creation, Razorpay
webhooks, success-page behavior, or the Draft Order feature flag.

The Draft Order architecture from PR 5A and PR 5B was live-tested in Production on
2026-10-01 with `RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true`. The observed Shopify
Admin GraphQL sequence was:

```text
CreateRazorpayDraftOrder
RazorpayDraftOrder
UpdateRazorpayDraftOrder
CompleteRazorpayDraftOrder
```

The payment produced one completed Shopify order. The project owner confirmed the
end-to-end checkout was working with the flag enabled. Keep the flag enabled in
Production unless performing an explicit rollback.

Historical causes and fixes are recorded in
[`razorpay-checkout-incident-2026-10-01.md`](./razorpay-checkout-incident-2026-10-01.md).
Planned hardening work is isolated in
[`razorpay-checkout-hardening-roadmap.md`](./razorpay-checkout-hardening-roadmap.md).
Those documents provide context; this file defines the current architecture.

## Scope

This document covers Razorpay Magic Checkout prepaid orders in the Hydrogen/Oxygen
storefront. FastRR is a separate provider selected by `CHECKOUT_PROVIDER` and must
remain isolated from this flow.

COD is not production-approved. The repository still contains a legacy
`order.placed` reconciliation path, but it must not be enabled or treated as a
supported Razorpay event until a real dashboard event and payload have been captured
and contract-tested.

## Non-negotiable invariants

Every future checkout change must preserve these rules:

1. A customer sees success only after the server has a real Shopify Order GID and
   order name.
2. A captured Razorpay payment produces at most one Shopify order.
3. With the anchor flag enabled, the Draft Order is the durable idempotency boundary.
   Do not add a second `orderCreate` writer for anchored checkouts.
4. `/api/checkout/razorpay/verify` is the only prepaid order-completion writer today.
5. `payment.captured` and `order.paid` webhooks are authenticated and acknowledged,
   but do not create or complete Shopify orders.
6. The browser-supplied order ID must equal the server-session order ID.
7. The Razorpay signature, order, payment, currency, amount, snapshot, and captured
   state are all verified on the server.
8. The exact Draft Order GID must come from server-authored Razorpay notes and, when
   available, match the server session. Never accept a client-selected Draft Order.
9. Shopify's recalculated Draft Order total must equal the captured Razorpay amount
   before completion.
10. Shiprocket is downstream of Shopify order creation. A Shiprocket absence is a
    symptom until Shopify creation has been proven.
11. No secret, access token, signature, address, email, phone number, or complete
    provider payload may be logged or returned to the browser.
12. Checkout ownership, webhook behavior, COD, idempotency, success-page polling,
    and UI must not be redesigned together in one release.

## Runtime components

| Component                                                      | Responsibility                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/lib/checkout/provider.ts`                                 | Selects Razorpay or FastRR.                                                                                                                                      |
| `app/routes/api.checkout.razorpay.order.ts`                    | Validates the requested Shopify products, creates the optional Draft Order anchor, creates the Razorpay order, and stores IDs in the session.                    |
| `app/lib/checkout/providers/razorpay/razorpay.server.ts`       | Creates Razorpay orders and verifies browser/webhook HMAC signatures using server-only secrets.                                                                  |
| `app/lib/checkout/providers/razorpay/razorpay.client.ts`       | Loads Magic Checkout and sends its success result to the verification route.                                                                                     |
| `app/routes/api.checkout.razorpay.verify.ts`                   | Session-binds and verifies the callback, then invokes reconciliation.                                                                                            |
| `app/lib/checkout/providers/razorpay/razorpay-order.server.ts` | Validates Razorpay's authoritative order/payment data and completes the anchored Shopify Draft Order. It also contains the compatibility `orderCreate` fallback. |
| `app/routes/webhooks.razorpay.ts`                              | Verifies raw webhook bodies and applies the current event policy.                                                                                                |
| `app/routes/checkout.razorpay.success.tsx`                     | Displays the Shopify order name only after confirmed server-side completion.                                                                                     |

## Configuration

Production Razorpay checkout requires:

```text
CHECKOUT_PROVIDER=razorpay
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
SHOPIFY_ADMIN_CLIENT_ID
SHOPIFY_ADMIN_CLIENT_SECRET
RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true
```

Use `SHOPIFY_ADMIN_STORE_DOMAIN=<shop>.myshopify.com` when
`PUBLIC_STORE_DOMAIN` is the public storefront domain. `RAZORPAY_BUSINESS_NAME` is
optional.

The installed Shopify app requires these Admin API scopes for the current path and
its compatibility fallback:

```text
read_orders
write_orders
read_draft_orders
write_draft_orders
```

Changing configured scopes is not sufficient by itself. Release the app version and
approve the updated scopes for the installed store before testing.

Razorpay Dashboard requirements:

- Magic Checkout is enabled.
- Shiprocket is connected and selected in Shipping Setup.
- Do not configure a competing custom Shipping Info API while Shiprocket owns that
  responsibility.
- Coupons remain disabled in the client (`show_coupons: false`) until real Get/Apply
  Promotions endpoints exist.
- Prepaid webhooks may include `payment.captured` and `order.paid`; both are currently
  acknowledgement-only.

## Authoritative identifiers and data

The integration deliberately carries several different IDs:

| Value                                     | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Razorpay order ID (`order_...`)           | Correlation key and payment container.                              |
| Razorpay payment ID (`pay_...`)           | Proof of the captured payment after server-side fetching.           |
| Shopify Draft Order GID                   | Durable one-checkout/one-order anchor.                              |
| Shopify Order GID                         | Final internal Shopify resource ID.                                 |
| Shopify order name (`#1018`, for example) | Customer-facing merchant order reference shown on the success page. |

The Razorpay order notes contain a compact server-generated checkout snapshot and,
when the flag is enabled, `shopify_draft_order_id`. The snapshot records variant ID,
quantity, and unit price in paise. Reconciliation rebuilds totals from this snapshot;
it does not trust browser prices.

## Current prepaid sequence

### 1. Start checkout

The storefront posts product IDs, quantities, and `source=cart|product` to:

```text
POST /api/checkout/razorpay/order
```

The route:

1. Rejects the request unless Razorpay is the selected provider.
2. Validates request size, method, source, product count, variant GIDs, and quantities.
3. Loads current product/cart data from Shopify and derives the authoritative INR
   amount.
4. With the anchor flag enabled, calls `draftOrderCreate` with the product variants,
   quantities, price overrides, INR presentment currency, internal tags, and checkout
   source.
5. Creates the Razorpay order with its line items, amount, checkout snapshot, and the
   Draft Order GID in `notes.shopify_draft_order_id`.
6. Stores both `razorpayOrderId` and `razorpayDraftOrderId` in the server session.
7. Returns only the public Razorpay key, Razorpay order ID, and business name to the
   browser.

If Draft Order creation succeeds but Razorpay order creation fails before returning an
order ID, the route attempts to delete that newly-created draft. Once a Razorpay order
exists, its draft must not be deleted automatically because a delayed payment may
still arrive.

### 2. Magic Checkout

The client opens Razorpay Magic Checkout with:

```text
one_click_checkout: true
show_coupons: false
```

Razorpay and its configured Shiprocket connection collect/validate delivery details
and supply shipping/COD fee information. No Razorpay secret is available to the
browser.

### 3. Browser verification

After the Razorpay success handler returns an order ID, payment ID, and signature, the
browser posts them to:

```text
POST /api/checkout/razorpay/verify
```

The route rejects malformed identifiers, a missing session order, or an order ID that
does not match the session. It then verifies:

```text
HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
```

The comparison is constant-time. A valid signature proves callback integrity; it is
not by itself proof that the payment is captured.

### 4. Authoritative Razorpay validation

The server fetches the Razorpay order and payment through the Razorpay API and
requires all of the following for prepaid completion:

```text
order.id matches the expected order ID
order.currency = INR
order.status = paid
order.amount_paid = order.amount
order.amount_due = 0
payment.id has the expected format
payment.order_id = order.id
payment.currency = INR
payment.status = captured
payment.captured = true
payment.amount = order.amount
snapshot line total = Razorpay line_items_total
order.amount = line total + shipping fee + COD fee
```

Razorpay's callback can arrive shortly before the final state is visible through its
API. Only the known non-final payment/order states are retried, using bounded delays:

```text
immediate -> 250 ms -> 750 ms -> 1500 ms
```

Invalid signatures, invalid data, Shopify authentication failures, and Shopify
mutation errors are not treated as transient payment propagation.

### 5. Complete the anchored Draft Order (PR 5B)

For a captured prepaid payment with the flag enabled and a valid anchor:

1. Query the exact Draft Order by GID (`RazorpayDraftOrder`).
2. If it already has a valid attached Shopify order, return that order without another
   mutation. This is the replay path.
3. Require the draft to exist and have `OPEN` status.
4. Update the draft (`UpdateRazorpayDraftOrder`) with verified shipping/billing
   addresses, email, phone, shipping charge, tags, note, Razorpay IDs, payment method,
   and checkout metadata.
5. Require the updated presentment total to be INR and exactly equal the captured
   Razorpay amount.
6. Complete the draft (`CompleteRazorpayDraftOrder`).
7. Require a valid attached Shopify Order GID and order name.
8. If the completion response is ambiguous or lost, query the Draft Order again. If it
   now has an attached order, return that order instead of attempting an independent
   order creation.

This works without an external database because Shopify owns the durable relationship
between one Draft Order and its completed Order. The in-memory promise map only
coalesces duplicate work inside one Oxygen isolate; it is an optimization, not the
idempotency guarantee.

### 6. Confirmation

After Shopify completion succeeds, verification:

1. Clears `razorpayOrderId` and `razorpayDraftOrderId` from the session.
2. Stores `shopifyOrderId` and `shopifyOrderName` in the confirmation session object.
3. Returns a redirect target for `/checkout/razorpay/success`.

The success loader requires a Shopify order name, consumes the confirmation, and then
renders that Shopify order number. It must never substitute a Razorpay order/payment ID
for the merchant order number.

## Why PR 5A and PR 5B succeeded

### PR 5A: shadow anchor

PR 5A proved that Production could create Shopify Draft Orders without changing the
known-good final-order writer. With the flag enabled, the storefront created a Draft
Order before Razorpay and copied its GID into Razorpay notes and the session. The
existing `orderCreate` path still created the final order. With the flag disabled, the
legacy flow created the final order and no draft.

This separated scope/schema/connectivity validation from final-order ownership.

### PR 5B: complete the anchor

PR 5B changed only the anchored prepaid finalization boundary. It replaced the
non-atomic `sourceIdentifier` lookup followed by `orderCreate` with update-and-complete
of the exact server-created Draft Order. The compatibility flow was preserved for
flag-off operation and old in-flight Razorpay orders without an anchor.

The production test with the flag enabled showed the expected four Shopify operations
and one final order. This validates the complete architecture—not merely successful
payment capture.

## Duplicate prevention and replay behavior

The old fallback performs:

```text
search source_identifier:<razorpay order id>
if absent -> orderCreate
```

That is useful compatibility protection but is not atomic. Two independent Oxygen
requests can both observe no order and both create one.

The anchored flow instead makes every caller resolve the same Draft Order GID. A
completed draft exposes its attached order, so a replay returns that order. A second
independent `orderCreate` must never be added after a draft completion error; always
query the draft again first.

The current prepaid webhooks are not writers, which also prevents the original race
between browser verification, `payment.captured`, and `order.paid`.

## Webhook policy

The public endpoint is:

```text
POST /webhooks/razorpay
```

It enforces POST, a bounded raw body, and HMAC verification using
`RAZORPAY_WEBHOOK_SECRET` before parsing JSON.

| Event                                 | Current production behavior                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `payment.captured`                    | Authenticated and acknowledged; no Shopify write.                                                       |
| `order.paid`                          | Authenticated and acknowledged; no Shopify write.                                                       |
| `payment.failed` and unrelated events | Authenticated and acknowledged; no Shopify write.                                                       |
| legacy `order.placed`                 | Parsed as a reconciliation event in code, but COD is disabled and this path is not production-approved. |

Do not make a prepaid webhook a writer until it calls the same anchored reconciliation
command and live shadow-mode evidence proves the selected event is delivered reliably.
Never allow a webhook to call a separate `orderCreate` path for an anchored checkout.

## Feature-flag behavior and rollback

### `RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true`

- Creates the Draft Order before the Razorpay order.
- Completes that same draft after verified captured payment.
- Provides the durable duplicate-prevention boundary.
- This is the live-tested Production configuration and should remain enabled.

### `RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=false`

- Does not create a Draft Order for new checkouts.
- Uses `sourceIdentifier` lookup plus `orderCreate`.
- Usually creates one order in the normal path, but the lookup/create pair cannot
  guarantee uniqueness across concurrent Oxygen workers.
- Exists as a rollback mechanism, not the preferred steady state.

If code is deployed with the flag enabled while an older in-flight Razorpay order has
no `shopify_draft_order_id`, that payment uses the legacy path instead of being
stranded.

## Abandoned and repeated checkouts

This is a known limitation, not a 5B failure:

1. Clicking **Buy now** with the flag enabled creates Draft Order A and Razorpay Order
   A.
2. Closing the Razorpay popup without paying leaves Draft Order A open.
3. Clicking **Buy now** again creates Draft Order B and Razorpay Order B; the current
   code does not reuse A.
4. The session now points to B. A normal successful payment for B completes only B.
5. A remains an open abandoned draft and does not become a final Shopify/Shiprocket
   order by itself.

Do not immediately delete an older draft merely because a new attempt starts: the old
Razorpay order could still be paid. Implement reuse/expiry/cleanup as a separate PR
with explicit state checks and tests.

## Failure behavior and observability

Shopify developer logs show only Admin GraphQL calls that reached Shopify. If no entry
appears there, inspect Oxygen logs and earlier stages first: request/session validation,
signature verification, Razorpay fetching, and final-state validation.

Verification classifies failures into safe public codes such as:

```text
RAZORPAY_PAYMENT_NOT_FINAL
RAZORPAY_ORDER_DATA_INVALID
SHOPIFY_ORDER_WRITE_FAILED
CHECKOUT_VERIFICATION_FAILED
```

GraphQL HTTP success does not mean mutation success. Every operation must check both
top-level GraphQL errors and mutation `userErrors` and must validate the returned
resource ID.

## Regression history: patterns that must not return

- Do not add unsupported Shopify input fields such as the previously rejected
  `sourceName` or `fulfillmentStatus: UNFULFILLED` without validating them against the
  deployed Admin API version.
- Do not assume updating app scopes in source updates the installed application.
- Do not allow browser verification and multiple webhook events to independently run
  non-atomic lookup-then-create logic.
- Do not replace a live-proven browser writer with an unproven webhook event.
- Do not assume `order.placed` exists for this account merely because legacy code names
  it.
- Do not return success immediately after signature verification; fetch and validate
  final Razorpay state.
- Do not make payment completion depend on a strict IP rate limit or a cache-based
  distributed lock.
- Do not add success-page polling while synchronous verification is the confirmed
  production path.
- Do not show a Razorpay ID as the Shopify order number.

## Required change process

Every Razorpay checkout PR must:

1. Start from the deployed, live-proven version.
2. Change one architectural concern only.
3. State which invariant in this document changes or remains untouched.
4. Include focused unit and integration tests.
5. Pass:

   ```text
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run test:integration
   npm run build
   ```

6. Deploy independently with an explicit rollback condition.
7. Run one low-value Production payment before merging onward.
8. Confirm exactly one Shopify order and one Shiprocket order.
9. Confirm the success page shows the same Shopify order name as Admin.
10. Stop immediately if payment succeeds without a Shopify order or if duplication
    occurs.

Generated `.react-router/types/*` files may appear modified after type generation on
Windows because of line endings. They are not part of a Razorpay architecture change
unless their textual content intentionally changed.

## Production acceptance checklist

For the current flag-enabled architecture, a successful test must prove:

- [ ] Razorpay reports one captured payment.
- [ ] `/api/checkout/razorpay/verify` succeeds.
- [ ] Shopify logs `CreateRazorpayDraftOrder`.
- [ ] Shopify logs `RazorpayDraftOrder`.
- [ ] Shopify logs `UpdateRazorpayDraftOrder`.
- [ ] Shopify logs `CompleteRazorpayDraftOrder`.
- [ ] That transaction does not log `CreateRazorpayOrder`.
- [ ] The draft is completed and attached to exactly one Shopify order.
- [ ] The final Shopify order contains Razorpay order/payment metadata.
- [ ] The total, currency, customer address, and shipping charge are correct.
- [ ] The Shopify order is paid and unfulfilled as expected.
- [ ] Shiprocket receives exactly one order.
- [ ] The success page displays the Shopify order name.
- [ ] Repeated verification does not create another final order.

## Future work boundaries

Handle these only in separate, independently deployed PRs:

- Reuse or lifecycle cleanup of abandoned Draft Orders.
- Webhook shadow observation, followed by anchored recovery for browser-closed payments.
- Durable webhook event audit/history if required.
- COD only after the real event contract is captured and tested.
- Rate limiting that cannot strand an already-paid customer.
- Expanded structured observability and alerting.

Until webhook recovery is implemented, a customer who closes the browser after the
payment is captured but before `/verify` completes may require operational recovery.
Do not solve that by adding an independent webhook `orderCreate` writer.
