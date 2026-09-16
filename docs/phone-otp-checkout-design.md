# Phone OTP verification at checkout

Status: Discussion draft  
Last reviewed: 2026-09-13  
Storefront: Shopify Hydrogen  
Current Shopify plan: Basic

## Objective

Prevent customers from completing an order with an arbitrary or unreachable phone number, such as `9999999999`.

The intended behavior is:

1. A guest must verify the checkout phone number with an OTP.
2. A logged-in customer may proceed without another OTP only when the exact phone number being used has already been verified.
3. A changed or previously unverified phone number must be verified before checkout.

Format validation and OTP verification solve different problems. A number such as `9999999999` can pass a syntactic check. OTP verification establishes that the buyer controls a reachable number; it does not establish the buyer's legal identity or ownership of the SIM.

## Executive conclusion

Shopify Basic cannot place a custom OTP interface inside the hosted information, shipping, or payment steps of Shopify Checkout. It can support an OTP gate in the Hydrogen cart before redirecting to checkout.

That storefront-only gate is useful, but it is not a complete security boundary. Direct checkout URLs, accelerated checkout paths, alternate sales channels, or a phone-number change inside checkout can bypass it.

The strongest solution while remaining on Basic is:

1. Verify the phone in the Hydrogen cart.
2. Bind the successful verification to the cart and exact normalized phone with a short-lived, signed proof.
3. Use a compatible public Shopify App Store app containing a Cart and Checkout Validation Function to reject unverified checkout attempts.
4. Reverify whenever the phone number changes.

If no suitable public app supports this Hydrogen/headless flow, Basic can provide a strong deterrent but not guaranteed enforcement across every checkout entry point.

Shopify Plus enables the clean custom implementation: a Checkout UI extension for the OTP experience plus a custom Cart and Checkout Validation Function for server-side enforcement. Plus still does not provide native phone OTP verification automatically; an app and an OTP delivery service are required.

## Shopify platform constraints

### Available on Basic

- Require the shipping-address phone field in Shopify checkout settings.
- Set checkout contact to email, or allow email or phone.
- Build the OTP experience in the Hydrogen cart or another storefront page.
- Use public App Store apps containing Shopify Functions.
- Use eligible extensions on the thank-you page, order-status page, and customer-account pages.
- Store a hidden cart attribute by prefixing its key with `_`.

### Not available as a custom Basic-plan solution

- A custom UI extension on the information, shipping, or payment checkout pages.
- A custom app containing Shopify Function APIs.
- A custom OTP field or modal inside the hosted checkout steps.
- The Checkout Branding API.
- A custom customer-account identity provider providing SMS OTP sign-in.

### Important Shopify data limitation

Shopify exposes a customer's phone number, but the Admin API does not expose a phone equivalent of `verifiedEmail`. The existence of a phone number on a customer or address record must not be interpreted as proof that the phone was verified.

Shopify's current customer accounts use an email verification code by default. A Shop sign-in may sometimes use an SMS code associated with the customer's Shop account, but that should not be treated as a merchant-controlled verification flag for the phone being supplied on the current checkout.

Our application therefore needs to own the verification record.

## Proposed Basic-plan architecture

```text
Buyer selects Checkout
        |
        v
Read current customer, cart, and requested phone
        |
        v
Normalize and validate phone syntax
        |
        v
Is this exact customer/cart phone already verified?
        | Yes                              | No
        v                                  v
Create/refresh signed proof        Send OTP through provider
        |                                  |
        |                                  v
        |                           Buyer submits OTP
        |                                  |
        |                                  v
        |                           Server verifies OTP
        |                                  |
        +------------------+---------------+
                           v
             Update cart buyer identity phone
                           |
                           v
       Add hidden signed cart verification attribute
                           |
                           v
              Redirect to Shopify Checkout
```

### Guest flow

1. Present a phone input before the checkout button can proceed.
2. Parse and normalize it to E.164, for example `+919876543210`.
3. Submit the phone to a server-only endpoint.
4. Apply bot protection and rate limits before requesting an OTP.
5. Ask the OTP provider to send the code.
6. Submit the entered code to a second server-only endpoint.
7. After successful verification, store the verification server-side and issue an opaque or signed proof bound to the cart and normalized phone.
8. Update the cart's buyer identity phone.
9. Add a hidden cart attribute such as `_phone_verification`.
10. Redirect to `cart.checkoutUrl`.

### Logged-in customer flow

1. Read the authenticated Customer Account API customer ID and current phone.
2. Look up our verification record using the customer ID and normalized phone.
3. Skip OTP only if the exact phone remains verified under the chosen expiration policy.
4. Require OTP if there is no record, the status is revoked or expired, or the phone differs.
5. After verification, upsert the record and bind the current cart proof to the same phone.

Suggested record shape:

```text
customer_id         nullable for guests
normalized_phone    E.164
status              verified | revoked
verified_at
expires_at          optional policy field
provider
provider_reference  non-secret identifier only
last_used_at
```

A logged-in customer's stored verification should improve convenience, but the cart proof should still bind the exact current cart and exact checkout phone.

## Enforcement levels

### Level 1: Hydrogen storefront gate

Modify the Hydrogen checkout action so the normal checkout button first completes OTP verification.

Advantages:

- Works on Basic.
- Full control over design and user experience.
- Can recognize authenticated customers and previously verified phones.
- Can be implemented in this repository.

Limitations:

- It does not independently protect direct or stale checkout URLs.
- Buy Now and accelerated checkout buttons must be removed, intercepted, or separately covered.
- A buyer may change the number after entering hosted checkout.
- Other storefronts or sales channels may not use this gate.

This level must be described as storefront enforcement, not universal checkout enforcement.

### Level 2: Public App Store validation on Basic

A public App Store app can include a Cart and Checkout Validation Function on stores using Basic. The function can reject invalid checkout state and target the phone field with an error. Shopify documents that validation functions also apply to express checkouts.

The ideal public app would validate a signed proof containing at least:

- Normalized verified phone
- Cart identifier or nonce
- Verification result
- Signature or other tamper-resistant value
- Expiration or revocation information, when the app architecture supports it

The function should reject checkout if the checkout phone does not match the verified phone.

We cannot deploy our own custom Function to a Basic store. Shopify limits custom apps containing Function APIs to Shopify Plus; all plans can use Functions delivered through public App Store apps.

### Level 3: Custom Plus checkout enforcement

On Plus, build:

- A Checkout UI extension placed on an appropriate checkout step.
- Network access from the extension to the OTP backend.
- The `block_progress` capability so the buyer cannot continue while unverified.
- A custom Cart and Checkout Validation Function as server-side defense.
- Signed Shopify/cart data linking the successful verification to the exact phone.

Ordinary Shopify Functions should not be designed to make a live call to the OTP database. Network access for the Cart and Checkout Validation Function is currently limited primarily to Shopify for enterprise arrangements. The checkout UI extension can call the backend and write signed verification state that the Function can validate locally.

## Recommended application components

### Hydrogen UI

- Phone entry component in the cart.
- Country code handling.
- OTP entry state.
- Resend countdown and attempt feedback.
- Accessible loading, error, success, and expired-code states.
- Checkout button that becomes available only after successful verification.

### Hydrogen server routes

Suggested endpoints:

```text
POST /api/phone-verification/start
POST /api/phone-verification/check
POST /api/phone-verification/revoke   optional
```

All calls to the OTP provider must run on the server. Provider credentials and verification secrets must never be returned to the browser.

### Phone handling

Use `libphonenumber-js` or an equivalent maintained library to:

- Parse national and international input.
- Apply the selected/default country.
- Produce one canonical E.164 representation.
- Reject impossible or structurally invalid input.

Do not use a simple ten-digit regex as the verification mechanism.

### OTP provider

Candidate provider categories include:

- Twilio Verify for managed SMS, WhatsApp, voice, and verification checks.
- An India-focused provider such as MSG91 or Exotel when domestic routing, pricing, support, or DLT handling is preferable.
- Another provider that supports the countries where the store sells.

Before selecting a provider, compare delivery coverage, sender/template requirements, India DLT handling, latency, abuse protection, data residency, support, per-verification pricing, and fallback channels.

### Persistent storage

Use a durable store such as PostgreSQL, Redis, Cloudflare D1/KV, or an equivalent platform service for:

- Customer-phone verification records.
- Verification attempt metadata.
- Replay protection and nonce status.
- Rate-limit counters, unless handled entirely by the provider or edge platform.
- Revocation and audit information.

Browser local storage is not sufficient evidence of verification.

### Abuse prevention

- Rate-limit by phone, IP, session, and cart.
- Add exponential resend delays.
- Limit verification attempts per challenge.
- Use Cloudflare Turnstile or comparable bot protection before sending OTPs.
- Restrict destination countries to supported selling markets.
- Enable the OTP provider's fraud/toll-fraud controls.
- Avoid revealing whether a phone belongs to an existing customer.
- Log security events without logging OTP values or unnecessary personal data.

## Cart proof design

After OTP success, the backend should produce a tamper-resistant proof. A conceptual payload is:

```json
{
  "version": 1,
  "cart": "cart-stable-identifier-or-nonce",
  "phone": "+919876543210",
  "verification": "approved",
  "issuedAt": 1789260000,
  "nonce": "random-single-use-value"
}
```

The browser must not possess the signing secret. Store the proof as a hidden cart attribute such as `_phone_verification`. Shopify notes that cart attributes beginning with `_` are hidden in checkout.

This design requires further review before implementation because Shopify cart IDs can change after mutations and a validation Function has deterministic execution constraints. The final proof format must be aligned with whichever public validation app or Plus Function performs enforcement.

## Shopify settings to configure

In Shopify Admin:

1. Go to **Settings > Checkout**.
2. Under customer information, set the shipping-address phone number to **Required**.
3. Decide whether the contact method should be **Email** or **Phone number or email**.
4. Decide whether customer sign-in is required.

Requiring account sign-in can reduce anonymous checkout paths, but Shopify notes that it disables accelerated checkout options such as Apple Pay on the online-store cart. Standard customer-account sign-in verifies email and is not a substitute for phone OTP.

## App Store options to evaluate

These are investigation candidates, not approved dependencies:

| App | Advertised behavior | Main concern for this project |
| --- | --- | --- |
| OTP+ B2B SMS & Social Login | Phone OTP login and verification around cart/checkout | Must confirm Basic, Hydrogen/headless, all payment methods, and server-side enforcement |
| RTOx Phone Verify & Limit COD | Phone OTP before checkout and COD restrictions | Appears COD-focused; must confirm non-COD use and Hydrogen integration |
| OTP Guard - Order Confirmation | Verifies orders and auto-cancels unverified orders | Post-order verification does not satisfy strict pre-payment blocking |
| COD King / Releasit COD products | OTP and risk controls for cash on delivery | Useful only if the requirement is limited to COD unless the vendor confirms broader coverage |

Ask every vendor:

1. Does the app support Shopify Basic?
2. Does it explicitly support Hydrogen/headless storefronts?
3. Does it verify all payment methods or only COD?
4. Does it support guests and logged-in customers?
5. Does it cover Buy Now, Shop Pay, wallet, and other accelerated checkouts?
6. Does changing the phone in Shopify Checkout require reverification?
7. Does it block completion before payment, or verify/auto-cancel after order creation?
8. Does it use a Cart and Checkout Validation Function?
9. Can it accept or generate a signed proof from a custom Hydrogen flow?
10. How does it identify a previously verified customer and phone combination?
11. What customer data and Shopify permissions does it access?
12. What are the SMS fees, fair-use limits, supported countries, and data-retention policy?

## Basic and Plus comparison for this project

| Capability | Shopify Basic | Shopify Plus |
| --- | --- | --- |
| Require a checkout shipping phone field | Yes | Yes |
| Public App Store apps using Shopify Functions | Yes | Yes |
| Custom app containing Shopify Functions | No | Yes |
| Custom UI extension on information/shipping/payment checkout pages | No | Yes |
| Custom OTP experience directly inside hosted checkout | No | Yes, after development |
| Extensions on thank-you/order-status/customer-account pages | Yes | Yes |
| Checkout Branding API | No | Yes |
| Full Checkout Blocks functionality during checkout | No | Yes |
| Custom identity provider with SMS OTP account sign-in | No | Yes |
| Market-specific checkout configurations | No | Yes |
| Draft checkout configurations | Up to 20 | Up to 99 |
| Native automatic phone OTP included in the plan | No | No |

On Basic, Checkout Blocks dynamic and static content can be placed on thank-you and order-status pages, but placement and most advanced functionality during checkout require Plus.

## Security and privacy requirements

- Never generate, store, compare, or log plaintext OTPs in browser code.
- Never expose provider API credentials or signing keys to the browser.
- Use HTTPS and server-only environment variables.
- Bind proof to the exact normalized phone and current cart or nonce.
- Invalidate proof when the phone changes.
- Prefer single-use or short-lived proof.
- Store the minimum required personal data and define a retention/deletion policy.
- Keep phone verification separate from SMS or WhatsApp marketing consent.
- Implement CSRF protection and secure, HTTP-only session cookies where applicable.
- Return generic responses that prevent customer-account enumeration.
- Monitor OTP delivery failures, resend volume, abuse, and verification conversion.
- Provide an accessible fallback/support flow for buyers who cannot receive an SMS.

## UX decisions still required

- Verify every order or only COD/high-risk orders?
- Verify on every checkout or remember a verified customer-phone pair?
- If remembered, how long does verification remain valid?
- Allow guest checkout, or require Shopify customer-account login?
- Which countries and calling codes are accepted?
- Should WhatsApp or voice be offered as a fallback?
- What happens during OTP provider downtime: fail closed, allow with review, or offer another payment path?
- Should changing the phone inside checkout be prohibited or simply trigger reverification?
- Are Buy Now and accelerated checkout buttons currently used and must they remain enabled?
- Is post-order verification plus automatic cancellation acceptable as a temporary solution?
- Is the requirement for every order or primarily prevention of fake COD/RTO orders?

## Suggested implementation phases

### Phase 0: Product and platform decisions

- Answer the open questions above.
- Confirm whether absolute, non-bypassable enforcement is required.
- Decide whether remaining on Basic is a hard requirement.
- Test candidate App Store apps in a development/test environment.
- Select the OTP provider and confirm India DLT/compliance requirements if applicable.

### Phase 1: Minimum useful Basic implementation

- Require the shipping phone field in Shopify settings.
- Add phone collection and normalization to the Hydrogen cart.
- Add OTP start/check server routes.
- Add rate limits, bot protection, and error handling.
- Update buyer identity and a hidden cart attribute after success.
- Gate the normal Hydrogen checkout button.
- Remove or separately handle bypassing Buy Now/accelerated paths.

### Phase 2: Returning-customer support

- Add durable customer-phone verification records.
- Check the authenticated customer and exact phone before prompting.
- Reverify changed, expired, or revoked numbers.
- Add an account-level phone verification/status experience if appropriate.

### Phase 3: Strong checkout enforcement

Choose one:

- Integrate a compatible public App Store validation app while remaining on Basic.
- Upgrade to Plus and build the custom Checkout UI extension and validation Function.

### Phase 4: Production hardening

- Test guest and authenticated flows.
- Test changed phone numbers.
- Test direct checkout URLs and stale verification proofs.
- Test Shop Pay, wallets, Buy Now, and other accelerated paths.
- Test OTP expiry, resend, failed delivery, rate limits, and provider outage.
- Add monitoring, audit logs, privacy retention, and support procedures.
- Measure OTP completion rate and checkout conversion impact.

## Acceptance criteria

The final implementation should not be considered complete until:

- A guest cannot use the supported checkout path without verifying the exact phone used for checkout.
- A logged-in customer skips OTP only for the exact phone previously verified under policy.
- Changing the phone invalidates verification.
- Obvious invalid formats are rejected before sending an OTP.
- OTP sending and checking are server-side and rate-limited.
- Direct, Buy Now, wallet, Shop Pay, and alternate checkout paths have documented test results.
- The solution's enforcement boundary is accurately documented.
- Customer-data retention and deletion behavior is documented.
- SMS/WhatsApp marketing consent is not inferred from verification.

## Shiprocket/Fastrr Checkout investigation

Investigation date: 2026-09-13

### Product distinction

The existing Shiprocket shipping/channel connection is a post-order logistics integration. It synchronizes Shopify orders into Shiprocket and fulfillment status back to Shopify. It does not provide the OTP and address-autofill checkout shown in the reference screenshot.

The screenshot is Shiprocket Checkout, now branded as **Fastrr Checkout**. Shiprocket describes this as a separate one-click checkout product with OTP login, address autofill, payments, COD controls, delivery information, and cart-recovery features.

Shiprocket also publishes separate Shopify applications:

- **Fastrr Login** for OTP phone validation and saved-address autofill.
- **Fastrr Cart** for a theme-oriented cart drawer, upsells, discounts, and rewards.
- **Fastrr COD** for payment-method and COD rules using Shopify Functions.
- The ordinary **Shiprocket** channel/app for shipping and fulfillment.

Installing or connecting the ordinary Shiprocket shipping app does not activate Fastrr Checkout.

### Hydrogen compatibility finding

Shiprocket publicly states that merchants can install a plugin for Shopify or use an SDK for custom solutions. Its Checkout site also states that the product works with Shopify and custom platforms.

However, no public Fastrr headless API reference was found for creating a checkout session, passing a Shopify Storefront API cart, loading the browser SDK, receiving callbacks, verifying webhooks, or mapping a completed transaction to a Shopify order.

The Fastrr Login App Store listing requests Online Store script-tag, theme, and checkout-page access. This strongly suggests that its plug-and-play installation targets Liquid themes. Hydrogen does not render Liquid theme app embeds or theme script injection, so installing the app alone should not be assumed to modify this storefront.

Hydrogen support is therefore feasible only through Shiprocket's custom-platform/headless onboarding. Implementation must wait for Shiprocket to provide merchant credentials and the current SDK/API contract. Endpoint names, payloads, events, and signature algorithms must not be guessed.

### Current repository integration point

The current handoff is in `app/components/CartSummary.tsx`:

```tsx
<a className="button primary checkout-button" href={checkoutUrl} target="_self">
  <p>Continue to Checkout &rarr;</p>
</a>
```

Both the cart page and cart drawer use this component, so replacing this link with a Fastrr launcher would cover those normal paths.

The repository has no Shiprocket/Fastrr Checkout client, SDK loader, session endpoint, webhook handler, or environment configuration. The existing Shiprocket shipping account is not referenced by the Hydrogen code.

There is also a bypass route in `app/routes/cart.$lines.tsx`. It creates a cart from a permalink and redirects directly to `cart.checkoutUrl`. It must be disabled or routed through the selected checkout flow.

### Target flow from the Hydrogen cart

```text
Hydrogen cart
    |
    v
Buyer selects Secure checkout
    |
    v
Hydrogen server reloads the authoritative Shopify cart
    |
    v
Server creates a short-lived Fastrr checkout session
    |
    v
Browser receives public configuration/session token only
    |
    v
Fastrr SDK opens its hosted modal
    |
    +--> phone OTP
    +--> saved/new address
    +--> delivery selection
    +--> prepaid/COD payment
    |
    v
Fastrr/Shopify connector creates or completes the Shopify order
    |
    v
Signed server webhook confirms final status
    |
    v
Hydrogen clears/reconciles the cart and shows confirmation
```

The exact division of responsibility between Fastrr and this application must come from Shiprocket's integration contract.

### Proposed changes after onboarding

1. Replace the checkout anchor in `CartSummary.tsx` with an accessible button and Fastrr state component.
2. Add a server-only route such as `POST /api/fastrr/session`.
3. Reload the authoritative cart with `context.cart.get()` and reject empty, stale, or unavailable carts.
4. Transform only fields required by Shiprocket's documented contract. Likely categories include cart ID, variant IDs, SKUs, quantities, authoritative totals, discounts, currency, customer identity, callback URL, and idempotency key; actual names must come from Shiprocket.
5. Call Fastrr's session API with server-only credentials.
6. Return only a short-lived session token and explicitly public SDK configuration to the browser.
7. Load the exact Fastrr SDK version and host provided by Shiprocket, with required Content Security Policy changes.
8. Open the Fastrr modal from the checkout button's user gesture.
9. Add a raw-body route such as `POST /api/fastrr/webhook` and verify signatures exactly as documented.
10. Make webhook processing idempotent by provider event ID and checkout/order ID.
11. Treat the signed webhook or Shopify order state as authoritative; never fulfill from a browser callback.
12. Reconcile or clear the Hydrogen cart after confirmed completion.
13. Keep `cart.checkoutUrl` as a controlled fallback only if policy permits unverified checkout.
14. Route or disable `cart.$lines.tsx` so it cannot bypass Fastrr.

If Fastrr returns a verified delivery address before handing off to Shopify Checkout, Hydrogen 2026 can place it on the cart using `cart.replaceDeliveryAddresses`/`CartForm.ACTIONS.DeliveryAddressesReplace` with strict validation. Whether that is needed depends on whether Fastrr owns the full checkout or only login/address collection.

### Data authority and consistency

- Reload the Shopify cart server-side when checkout begins; never trust browser-submitted prices.
- Recreate the Fastrr session whenever lines, quantities, discounts, gift cards, buyer identity, or delivery details change.
- Confirm whether Shopify or Fastrr owns shipping rates, discounts, taxes, and inventory calculations. Each calculation needs one authority.
- Confirm how Fastrr records Shopify transactions so refunds, cancellations, financial status, and fulfillment stay consistent.
- Confirm Markets and currency handling. The current Hydrogen context uses country `US`, while the proposed checkout is India-specific; localization must be corrected before launch.

### Required Shiprocket onboarding package

Request all of the following before writing integration code:

1. Written confirmation that Fastrr Checkout supports Shopify Hydrogen/headless on Shopify Basic.
2. Sandbox/test merchant account.
3. Current headless JavaScript SDK documentation and pinned SDK URL.
4. Sandbox and production API base URLs.
5. Public merchant/store identifier and server-only credentials.
6. Exact create-session request and response schemas.
7. Required cart, product, variant, price, tax, shipping, discount, and gift-card fields.
8. OTP behavior for new/returning users, including Skip-OTP policy.
9. Saved-address consent, ownership, retention, correction, and deletion behavior.
10. Prepaid gateway options and whether the existing Razorpay account can be used.
11. COD, partial-COD, RTO, pincode, and shipping-rule behavior.
12. Shopify order-creation flow and idempotency guarantees.
13. Browser success, cancel, and error callback definitions.
14. Webhook events, raw-body signature algorithm, retries, ordering, and replay protection.
15. Refund, cancellation, pending, failure, duplicate-payment, and abandonment behavior.
16. CSP domains needed for scripts, frames, connections, images, and forms.
17. Production-domain allowlisting requirements.
18. Support ownership and incident/outage escalation path.
19. Complete platform, order, OTP, COD/RTO, gateway, and Shopify transaction fees.
20. Confirmation that it works when Liquid is not the public storefront.

### Go/no-go gate

Proceed only if Shiprocket confirms that its official connector creates and reconciles Shopify orders from a Hydrogen checkout session. If it expects this application to capture payment independently and manufacture Shopify orders through the Admin API, stop and reassess: that adds substantial reconciliation, tax, discount, inventory, refund, and compliance risk.

Until the headless contract is received and tested, the correct production fallback is Shopify's `cart.checkoutUrl`, not an inferred or reverse-engineered Shiprocket API.

## Razorpay Magic Checkout alternative

### Recommendation

Razorpay Magic Checkout is currently the stronger candidate for this store than building an OTP system from scratch or integrating against an undocumented Fastrr headless interface. The store already uses Razorpay, and Razorpay publishes both a Shopify onboarding path and a custom-web integration contract.

COD can be offered only inside Razorpay Magic Checkout. After that flow has passed end-to-end testing, Shopify's native/manual COD method should be disabled so a customer cannot bypass Razorpay's phone, address, serviceability, or RTO checks by entering Shopify Checkout directly.

This requires **Magic Checkout enablement** by Razorpay. Having the ordinary Razorpay payment gateway installed does not by itself enable Magic Checkout, OTP login, address autofill, or Razorpay-managed COD.

### Critical distinction for Hydrogen

Razorpay documents two materially different integrations:

| Integration | COD configuration | Shopify order handling | Fit for this store |
| --- | --- | --- | --- |
| Official Razorpay Magic Checkout for Shopify | Razorpay Dashboard: **Magic Checkout > COD Settings > COD Setup**, including location, product, order-value, partial-COD, and RTO controls | Expected to use Razorpay's Shopify connector, but its exact Hydrogen/headless behavior must be confirmed in writing | Preferred, if Razorpay confirms official Hydrogen support and automatic Shopify order synchronization |
| Razorpay Magic Checkout for a custom website | The dashboard COD setting does not apply; the application's shipping-info API must return whether each method supports COD and its COD fee | The merchant backend must process the result; the public custom-web guide does not promise automatic creation of a Shopify order | Technically possible but substantially more implementation and reconciliation risk |

Razorpay's published Shopify onboarding is theme-oriented: it requests a test theme, Shopify collaborator access, sales-channel product configuration, and re-enablement after a theme change. Hydrogen does not render a Shopify Liquid theme. We must therefore not assume that the ordinary Shopify installation will automatically replace this Hydrogen cart button.

The preferred go/no-go condition is written confirmation from Razorpay that it can combine:

- Shopify Basic;
- a public Hydrogen/Oxygen storefront;
- Razorpay Magic Checkout launched from the Hydrogen cart;
- Magic SSO/mobile OTP and saved-address autofill;
- prepaid and COD in the same Razorpay checkout;
- automatic creation and reconciliation of both prepaid and COD orders in Shopify; and
- the existing Shiprocket Shopify channel receiving those Shopify orders for fulfillment.

### Intended production flow

```text
Hydrogen cart
  -> Razorpay Magic Checkout (OTP/login and address)
  -> customer selects prepaid or COD
  -> Razorpay's official Shopify connector creates/updates the Shopify order
  -> Shiprocket's normal Shopify channel imports the unfulfilled order
  -> Shiprocket handles shipment and tracking
```

Shiprocket should remain the post-order logistics system in this design. It does not need to own customer OTP or collect payment if Razorpay Magic Checkout owns those steps.

For a COD order, Razorpay is not capturing an online payment. The integration must still create a Shopify order with a consistent pending/unpaid COD financial state, gateway label, tags, totals, taxes, discounts, shipping charge, address, and phone. These exact fields must be tested because Shiprocket's order import and COD classification depend on them.

### Hydrogen changes if Razorpay approves the official headless path

1. Replace the checkout anchor in `app/components/CartSummary.tsx` with the Razorpay-provided Magic Checkout launcher.
2. Create server-only routes for any session/order creation and never expose the Razorpay key secret in browser code.
3. Verify prepaid payment signatures and Razorpay webhooks on the server, with idempotency and replay protection.
4. Use the vendor-defined COD completion callback/webhook; do not treat closing the browser modal as an order success.
5. Remove or guard the direct `cart.$lines.tsx` checkout redirect so it cannot bypass verification.
6. Keep Shopify's native checkout URL as a controlled rollback path during testing, then remove public access to that path if verification must be mandatory.
7. Ask Razorpay whether its connector depends on a Shopify manual payment method. Disable Shopify's separate customer-facing COD path only after Razorpay confirms it is safe and Razorpay COD orders have been proven to reach both Shopify and Shiprocket correctly.

If Razorpay instead classifies Hydrogen as a generic custom website, this application would also need to create Razorpay orders, expose promotion and shipping-information endpoints, return `serviceable`, `shipping_fee`, `cod`, and `cod_fee`, verify payment results, and reliably create/reconcile the corresponding Shopify order. That is not the recommended first choice.

### What Razorpay can validate

Magic Checkout can provide an OTP/mobile-login step, saved contact/address autofill, prepaid payments, COD, partial COD, COD-to-prepaid conversion, and RTO controls. Razorpay's COD Intelligence can allow or block COD using signals such as phone number, email, IP address, and pincode.

OTP proves that the shopper controls the number at that moment. It does not prove that the delivery address is genuine or that a COD parcel will be accepted. Address serviceability, RTO scoring, rate limits, resend cooldowns, and abuse controls should therefore remain enabled.

### Shopify Basic implications

Razorpay documents Shopify onboarding for Magic Checkout and specifically notes a Shopify Basic limitation: after a successful order, Basic-plan merchants can be sent to a Razorpay-hosted thank-you page because Shopify's Additional Scripts capability may be unavailable. Some checkout/conversion analytics also remain in Razorpay rather than Shopify. This is not, by itself, a reason to upgrade to Plus.

Keeping Shopify's Online Store password enabled is not a supported substitute for storefront routing. Even if Magic Checkout prevents the normal shopper from visiting Shopify Checkout, the official integrations can still rely on Shopify sales-channel, theme, callback, order-status, or connector behavior. The Online Store password should be removed for production and Hydrogen should be configured as the public storefront according to Shopify's headless launch guidance.

### Questions to send Razorpay before implementation

Use the following request with `magic-checkout-support@razorpay.com`:

> We use Shopify Basic with a public Hydrogen/Oxygen storefront; the Liquid theme is not our public storefront. Razorpay Payment Gateway is already active, and Shiprocket is connected to Shopify for fulfillment. Please enable Razorpay Magic Checkout with Magic SSO/mobile OTP, prepaid, and COD. Confirm whether your official Shopify connector supports launching from Hydrogen, how the Hydrogen cart is passed, and whether it automatically creates and reconciles Shopify orders for both prepaid and COD. Please provide the supported SDK/session API, callbacks, webhook and signature specifications, CSP domains, test mode, COD financial-status/gateway mapping, thank-you-page behavior, fees, and instructions for disabling Shopify native COD without breaking the integration.

Do not start the Hydrogen implementation until Razorpay answers the Shopify-order-synchronization question. That is the boundary between a relatively small cart integration and building a separate commerce/order orchestration layer.

## References

- [Shopify checkout app availability](https://help.shopify.com/en/manual/checkout-settings/checkout-customization)
- [Checkout and accounts customization comparison](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations)
- [Editing checkout form options](https://help.shopify.com/en/manual/checkout-settings/checkout-form-options)
- [Checkout Blocks plan requirements](https://help.shopify.com/en/manual/checkout-settings/checkout-blocks)
- [Checkout UI extensions](https://shopify.dev/docs/api/checkout-ui-extensions/latest)
- [Checkout extension capabilities and block progress](https://shopify.dev/docs/apps/build/checkout/capabilities)
- [Cart and Checkout Validation Function API](https://shopify.dev/docs/api/functions/latest/cart-and-checkout-validation)
- [Shopify Functions plan availability](https://shopify.dev/docs/api/functions/latest)
- [Network access for Shopify Functions](https://shopify.dev/docs/apps/build/functions/network-access)
- [Hydrogen cart attributes](https://shopify.dev/docs/storefronts/headless/hydrogen/cart/attributes)
- [Shopify Customer Admin API](https://shopify.dev/docs/api/admin-graphql/latest/objects/Customer)
- [Customer-account sign-in customization](https://help.shopify.com/en/manual/customers/customer-accounts/upgrade/customization-options)
- [Customer Account API with Hydrogen](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/hydrogen)
- [Twilio Verify API](https://www.twilio.com/docs/verify/api)
- [Twilio Verify rate limits](https://www.twilio.com/docs/verify/api/programmable-rate-limits)
- [Twilio Verify fraud prevention](https://www.twilio.com/docs/verify/preventing-toll-fraud)
- [OTP+ B2B SMS & Social Login](https://apps.shopify.com/otp-plus-social-login)
- [RTOx Phone Verify & Limit COD](https://apps.shopify.com/phone-verify-secure-cod)
- [OTP Guard - Order Confirmation](https://apps.shopify.com/otp-guard-order-verification)
- [Fastrr Checkout](https://checkout.shiprocket.in/)
- [Shiprocket one-click checkout integration overview](https://checkout.shiprocket.in/blog/one-click-checkout/)
- [Fastrr Login Shopify app](https://apps.shopify.com/shiprocket-smart-address)
- [Fastrr Cart Shopify app](https://apps.shopify.com/shiprocket-smart-cart)
- [Fastrr COD Shopify app](https://apps.shopify.com/shiprocket-smart-cod)
- [Shiprocket Shopify shipping/channel integration](https://support.shiprocket.in/support/solutions/articles/43000659886-how-do-i-integrate-shopify-as-a-channel-with-shiprocket-)
- [Razorpay Magic Checkout for Shopify](https://razorpay.com/docs/payments/magic-checkout/shopify/)
- [Razorpay Magic Checkout FAQs](https://razorpay.com/docs/payments/magic-checkout/troubleshooting-faqs/)
- [Razorpay Magic Checkout custom-web integration](https://razorpay.com/docs/payments/magic-checkout/web/?preferred-country=IN)
- [Razorpay Magic Checkout features](https://razorpay.com/docs/payments/magic-checkout/features/)
- [Razorpay COD allowlist and blocklist](https://razorpay.com/docs/payments/magic-checkout/rto-reduction/allowlist-blocklist/)
- [Razorpay Shopify COD plugin](https://razorpay.com/docs/payments/payment-gateway/ecommerce-plugins/shopify-cod/)
- [Razorpay Magic Checkout Shopify order analytics](https://razorpay.com/docs/payments/magic-checkout/shopify/order-analytics/)
