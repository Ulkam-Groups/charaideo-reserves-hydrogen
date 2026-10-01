# Razorpay checkout incident — 2026-10-01

## Summary

Razorpay payments completed successfully, but Shopify order creation was intermittently or completely failing. Earlier in the incident, a single payment could also create two Shopify orders.

The incident was not caused by one defect. It was a sequence of independent problems:

1. Invalid variables were sent to Shopify's `orderCreate` mutation.
2. The Shopify app initially lacked the required `write_orders` scope.
3. Multiple asynchronous callers could create the same Shopify order.
4. A broad reconciliation redesign replaced the previously working browser callback flow and introduced a no-order regression.
5. After restoring the known-good flow, the browser callback could still run before Razorpay's REST API reflected the final `paid`/`captured` state.
6. All reconciliation failures were returned as the same generic `502`, while Shopify's developer logs only showed requests that had already reached Shopify.

## Customer impact

- Customers could see a successful Razorpay payment while no Shopify order was created.
- Some successful payments created duplicate Shopify orders.
- When no Shopify order existed, downstream Shiprocket order processing could not begin.
- The storefront returned one of these generic responses without identifying the failing stage:

  ```json
  {"error":"Payment verification or order creation failed"}
  ```

## Technical flow

The prepaid checkout path is:

```text
Razorpay success callback
  -> POST /api/checkout/razorpay/verify
  -> validate the session-bound Razorpay order ID
  -> verify the Razorpay checkout signature
  -> fetch the Razorpay order
  -> fetch the Razorpay payment
  -> require order=paid and payment=captured
  -> authenticate with Shopify Admin
  -> look for an existing order by sourceIdentifier
  -> create the Shopify order when none exists
  -> redirect to the success page
```

Shiprocket receives the order only after the Shopify order has been created. It was therefore a downstream symptom, not the source of the verification failure.

## Timeline and root causes

### 1. Shopify `INVALID_VARIABLE`

The original `OrderCreateOrderInput` contained fields that were rejected by the active Shopify Admin GraphQL schema.

- Commit `4f5dea9` removed `sourceName: "Razorpay Magic Checkout"`.
- The request still contained `fulfillmentStatus: "UNFULFILLED"`.
- Commit `a6b66ba` removed that value, after which Shopify order creation worked.

The unfulfilled state should be represented by omitting `fulfillmentStatus`, rather than sending an unsupported enum value.

### 2. Missing Shopify order-write permission

The Shopify app initially had these scopes:

```text
write_draft_orders
read_draft_orders
read_orders
read_products
```

Creating an order through `orderCreate` requires `write_orders`. Updating the app configuration alone is insufficient: the new app version must be released and its scope update approved for the installed store.

The required scopes for this flow are:

```text
read_orders,write_orders
```

### 3. Duplicate Shopify orders

The browser callback and multiple Razorpay webhook events were all allowed to execute the same reconciliation flow:

- Browser `POST /api/checkout/razorpay/verify`
- `payment.captured`
- `order.paid`

Each writer performed a non-atomic lookup followed by creation:

```text
Browser callback             Razorpay webhook
       |                            |
       +-- lookup: no order         +-- lookup: no order
       +-- create Shopify order     +-- create Shopify order
```

Shopify's `sourceIdentifier` is searchable, but it is not a uniqueness constraint. An in-memory promise map can coalesce requests inside one worker instance, but it cannot provide distributed locking across separate Oxygen requests or worker instances.

The selected mitigation is a single prepaid writer:

- `/api/checkout/razorpay/verify` is the only prepaid Shopify-order writer.
- `payment.captured` is authenticated and acknowledged without creating an order.
- `order.paid` is authenticated and acknowledged without creating an order.

### 4. Reconciliation redesign regression

Starting with `3f7ba50`, the checkout and reconciliation implementation was substantially redesigned. The change introduced webhook/status-polling behavior and altered ownership of Shopify order creation.

This removed the duplicate race but also removed the only production-proven order-creation path. If the expected webhook was unavailable, delayed, misconfigured, or mapped to an event Razorpay did not publish for this checkout, payment succeeded without a Shopify order being created.

The integration was restored to the known-good `a6b66ba` behavior, retaining only the narrow single-writer duplicate prevention.

### 5. Razorpay final-state propagation race

The restored browser callback verified the checkout signature and then immediately fetched the Razorpay order and payment. It required:

```text
order.status = paid
payment.status = captured
payment.captured = true
```

Razorpay's success callback can arrive before those final values are consistently visible through the Razorpay REST API. The previous implementation treated an intermediate `attempted`, `authorized`, or otherwise non-final state as a permanent failure and returned `502`.

This happened before Shopify authentication or GraphQL, which explains why no new entry appeared in Shopify's developer logs.

Commit `adc7474` added bounded retries only for these two transient reconciliation failures:

```text
Razorpay payment is not captured
Razorpay order is not payable
```

Retry delays are:

```text
250 ms -> 750 ms -> 1500 ms
```

Permanent failures such as invalid order data or Shopify authentication errors are not retried.

After this deployment, Shopify recorded:

- `RazorpayExistingOrder` at 07:06:22 IST.
- `CreateRazorpayOrder` at 07:06:24 IST.
- The Shopify order was created successfully.

Because the retry was the only material runtime behavior change between the restored failing version and the successful version, Razorpay final-state propagation is the probable primary cause of the final recurring `502`. This conclusion has high confidence, but it is not absolute proof because the pre-fix Oxygen exception was not captured.

### 6. Observability gap

The handler collapsed signature, Razorpay API, Razorpay validation, Shopify authentication, Shopify GraphQL, and Shopify mutation failures into one response.

It also reported the exception only through an optional application monitor. When monitoring was unavailable or not being inspected, there was no useful server-side evidence.

Shopify's developer dashboard is not an end-to-end checkout log. It only shows Admin GraphQL calls that reached Shopify. Failures during session validation, Razorpay signature verification, Razorpay fetching, or Razorpay final-state validation will not appear there.

The verification route now emits a structured Oxygen error and returns a safe operational code such as:

- `RAZORPAY_PAYMENT_NOT_FINAL`
- `RAZORPAY_ORDER_DATA_INVALID`
- `SHOPIFY_ORDER_WRITE_FAILED`
- `RAZORPAY_AUTHENTICATION_FAILED`
- `RAZORPAY_PROVIDER_UNAVAILABLE`
- `CHECKOUT_VERIFICATION_FAILED`

No key secrets, signatures, addresses, customer details, or complete upstream error messages should be logged.

## Current prepaid behavior

```text
Razorpay browser success
  -> verify signature
  -> retry only while paid/captured state is pending
  -> check Shopify for sourceIdentifier
  -> create one Shopify order
  -> allow the normal downstream Shiprocket processing
```

The prepaid webhooks may remain selected in Razorpay. They are acknowledged but do not write Shopify orders.

COD remains disabled. It must not be enabled until a real Razorpay Magic Checkout COD event name and payload have been captured and tested. `order.placed` must not be assumed to exist merely because older integration code referenced it.

## Verification checklist

For every checkout-related release, verify all of the following in the production-like environment:

1. Razorpay creates one payment and reports it captured.
2. `/api/checkout/razorpay/verify` returns success.
3. Shopify performs one existing-order lookup.
4. Shopify creates exactly one order.
5. The Shopify order contains the Razorpay order and payment identifiers.
6. Replaying the browser verification request does not create another order.
7. Replaying `payment.captured` and `order.paid` does not create another order.
8. Shiprocket receives exactly one order.
9. The success page displays the Shopify order number.
10. A forced non-final Razorpay response is retried and does not immediately become a generic `502`.

## Preventive actions

### Application

- Preserve one canonical prepaid writer.
- Keep retries bounded and limited to known transient Razorpay finalization states.
- Never retry invalid signatures, invalid order data, Shopify authentication failures, or Shopify mutation validation errors as if they were transient payment states.
- Retain the existing-order lookup, while recognizing that it is not a distributed uniqueness guarantee.
- If webhook-based recovery is added later, use a durable idempotency record or distributed lock rather than an in-memory map.
- Validate Shopify Admin GraphQL variables against the selected API version before deployment.
- Verify the installed app scopes, not only the scopes written in configuration.

### Monitoring

- Inspect Oxygen runtime logs for pre-Shopify failures.
- Include a safe failure code and processing stage with every server-side verification failure.
- Correlate browser responses and Oxygen logs using `X-Request-Id`.
- Alert on successful Razorpay payments that have no Shopify order after a defined recovery window.

### Release process

- Avoid redesigning payment ownership, COD, success-page polling, idempotency, and webhook behavior in one change.
- Start from the last live-proven commit and make one independently testable correction at a time.
- Require a live low-value payment test before promoting checkout changes.
- Protect `main` from direct pushes and require pull-request checks.
- When creating a local branch from remote `main`, prevent accidental upstream tracking:

  ```text
  git switch --no-track -c <branch-name> origin/main
  git push -u origin HEAD
  ```

## Relevant commits

- `4f5dea9` — removed `sourceName` from the Shopify order input.
- `a6b66ba` — removed invalid `fulfillmentStatus`; known-good Shopify and Shiprocket creation path.
- `3f7ba50` — beginning of the broad reconciliation redesign associated with the no-order regression.
- `ece19e1` — restored the known-good implementation plus narrow duplicate prevention.
- `adc7474` — added bounded Razorpay finalization retries and safe verification diagnostics.

