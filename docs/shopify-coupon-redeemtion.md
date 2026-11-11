Inspect and fix Shopify coupon-redemption tracking in my Hydrogen application
using Razorpay Magic Checkout.

CURRENT SETUP
Customers can already apply coupons and pay the discounted amount through
Razorpay Magic Checkout.

What remains missing or unverified:
- Shopify knows which coupon was redeemed.
- The redemption is linked to the correct customer and Shopify order.
- The payment/redemption timestamps and Razorpay references are recorded.
- Shopify’s native coupon usage tracking and usage restrictions behave correctly.

Do not assume this application uses Shopify-hosted checkout or standard
Razorpay Checkout.

STEP 1: INSPECT BEFORE CHANGING CODE

Trace the repository’s actual flow:
coupon entry → validation → discount calculation → Magic Checkout →
payment verification/webhooks → Shopify order creation/completion.

Identify:
- Relevant routes, services, webhook handlers and database models.
- Whether we use a Magic Checkout Shopify connector or custom integration.
- Whether coupons originate in Shopify, Razorpay or our own database.
- Which system validates coupons and calculates discounts.
- When Shopify orders are created and how customers are associated.
- How discount codes and amounts are currently attached to Shopify orders.
- How Razorpay orders/payments map to Shopify orders.
- Any existing synchronisation, retry or reconciliation mechanism.
- Shopify API version, permissions and webhook configuration.

Explain the actual gap with file paths before implementing a fix.
Do not introduce a duplicate order-creation or redemption pipeline.

STEP 2: VERIFY THE SUPPORTED APPROACH

Use current official Shopify and Razorpay Magic Checkout documentation for
the exact integration used in this repository.

Verify these as separate requirements:
1. Recording the actual discount code and discount amount on a Shopify order.
2. Associating that order with the correct customer.
3. Updating Shopify’s native discount usage count/history.
4. Enforcing total-use and one-use-per-customer restrictions.

Do not assume an API-created order containing a coupon automatically validates
its rules or increments native usage.

A note, tag, custom attribute or metafield containing the coupon is not proof
of native redemption.

Do not invent a “mark coupon used” endpoint.
Do not change the configured usage limit to simulate a redemption.
Use supported current APIs for new work.

If the current architecture cannot support native redemption tracking or
strict usage-limit enforcement, explain why with documentation and propose
the smallest supported alternative. Get my approval before changing checkout
architecture.

STEP 3: IMPLEMENT SECURE PAYMENT SYNCHRONISATION

Reuse the existing Magic Checkout and Shopify order flows where possible.

- Verify Razorpay signatures according to the official integration docs.
- Do not trust browser success callbacks alone.
- Confirm the appropriate server-verified payment status.
- Do not treat authorisation alone as captured payment.
- Verify amount, currency and order reference against trusted server data.
- Do not trust browser-supplied discount amounts or customer identity.
- Associate the payment with the correct existing Shopify order, or create/
  complete the order using the verified supported flow.
- Record the external payment without initiating another charge.
- Keep credentials and secrets server-side.

Make processing idempotent across:
- Browser callbacks and webhooks.
- Duplicate or out-of-order events.
- Concurrent requests and worker retries.
- Timeouts where Shopify might already have accepted the request.

Persist mappings and processing state durably.
Use database uniqueness constraints or equivalent safeguards.

If payment succeeds but Shopify synchronisation fails:
- Never charge again.
- Persist the failure and retry safely.
- Reconcile whether the Shopify order already exists before recreating it.
- Expose unresolved failures for investigation.

STEP 4: RECORD ATTRIBUTION

Make it possible to identify:
- Shopify discount code and its identifier where available.
- Shopify order ID and order name.
- Customer ID where available.
- A defined guest identity strategy.
- Confirmed payment timestamp.
- Shopify synchronisation timestamp.
- Discount amount and currency.
- Razorpay order/payment references.
- Storefront/integration source.

Keep “coupon applied during checkout” separate from “coupon redeemed on a
completed purchase”.

Use native Shopify discount/order fields for actual redemption.
Use notes, attributes or metafields only for supplementary audit references.
Avoid unnecessary personal data and never log secrets.

STEP 5: VALIDATE DISCOUNT RULES BEFORE PAYMENT

Inspect and fix validation of:
- Active status and start/end dates.
- Customer eligibility.
- Applicable products, variants and collections.
- Minimum spend or quantity.
- Discount calculation and currency rounding.
- Combination rules.
- Total-use limits.
- One-use-per-customer restrictions.
- Discount types supported by this application.

Ensure Shopify and Razorpay totals agree.
Do not apply the discount twice.
Reject unsupported discount types explicitly.

Address concurrent attempts to redeem the last available use.
A read-before-payment check is not an atomic reservation.

Account for usage through other sales channels.
Do not claim a local database lock enforces Shopify-wide limits unless that
guarantee is supported.

If reservations are needed, define expiry, release and reconciliation.
Clearly document any limit that cannot be strictly enforced.

STEP 6: HANDLE EDGE CASES

Define verified behaviour for:
- Failed and abandoned payments.
- Delayed confirmation.
- Authorised but uncaptured payments.
- Coupons expiring or changing during checkout.
- Successful payment followed by Shopify failure.
- Cancelled orders.
- Full and partial refunds.

Do not assume cancellation or refund restores coupon usage.
Verify this for the exact integration path.

STEP 7: TEST AND PROVE THE RESULT

Add automated tests and an authorised test-environment verification plan for:
- Successful discounted payment linked to exactly one Shopify order.
- Correct customer and guest attribution.
- Native discount representation on the order.
- Native Shopify usage count/history before and after purchase.
- Reusing a one-use-per-customer coupon.
- An exhausted total-use limit.
- Concurrent attempts for the final available redemption.
- Expired/ineligible coupons.
- Tampered amounts, coupon data and customer identity.
- Invalid signatures.
- Duplicate/out-of-order events.
- Browser closing before the success callback.
- Shopify failure after successful payment, followed by safe reconciliation.
- No duplicate order, charge or redemption after retries.

Acceptance requires proving native Shopify redemption behaviour for the exact
order flow, or explicitly documenting why it is unsupported.
Showing the coupon in a note or metafield is insufficient.

Use mocks or an authorised test environment.
Do not charge live payments, modify real customer orders, deploy to production
or replace checkout architecture without my approval.

DELIVERABLES
- Current flow and root-cause explanation, with file paths.
- Official documentation supporting the chosen solution.
- Smallest safe implementation.
- Automated tests and results, distinguishing executed tests from proposed ones.
- Required database migrations.
- Required environment-variable names, permissions and webhook configuration.
- Verification steps in Shopify and Razorpay.
- Remaining limitations around native usage tracking, guest identity,
  cross-channel limits and concurrency.

Begin by inspecting the repository. Preserve the working Magic Checkout
integration wherever possible.

