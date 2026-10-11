# International Commerce and Razorpay Plan

Status: **documented and intentionally deferred until IEC and production account setup are complete**.

This document records what is implemented today, what is deliberately blocked, and the implementation plan for Canada, the United States, and future international markets.

## Desired customer experience

1. Detect the visitor's likely country from the production edge request.
2. Suggest the matching Shopify Market, without silently overriding an explicit customer choice.
3. Let the customer select another country/language and retain that selection for the browser session.
4. Query Shopify in that country and language context.
5. Display Shopify's market-specific product availability, translated content, currency, and configured price adjustment (for example the US 120% adjustment rendered in USD).
6. Keep the cart buyer identity synchronized with the selected country.
7. At checkout, charge the exact server-validated Shopify contextual price in the corresponding supported Razorpay currency.
8. Create/reconcile the Shopify order only after Razorpay payment verification.
9. Fulfil international orders through Shiprocket only after the destination, serviceability, rates, documents, duties, and export workflow are configured.

## Implemented now

### Locale and market selection

- Supported locale keys are `en-in`, `en-us`, `en-ca`, and `fr-ca`.
- India English retains existing unprefixed URLs.
- International routes use `/en-us`, `/en-ca`, and `/fr-ca` prefixes.
- A locale selection is stored as `localePreference` in the signed application session.
- Explicit locale URLs override the saved session preference.
- Production country suggestion can use edge country headers; local testing supports an explicit country override.
- The selected country is passed to Hydrogen's Storefront API client as its `i18n` context.
- When the locale changes, an existing Shopify cart is updated through `cart.updateBuyerIdentity({countryCode})`.

### Shopify localized data

- Product, collection, search, page, policy, recommendation, reserve-list, homepage collection, and storefront-notice queries use or are being standardized on:

  ```graphql
  @inContext(country: $country, language: $language)
  ```

- Hydrogen injects the active country and language variables into Storefront API queries.
- Shopify controls contextual availability, translated resource fields, presentment currency, and market price adjustments.
- For custom React content, Shopify content is preferred when a corresponding Storefront API resource exists; otherwise the component's existing coded content remains.
- No manually invented French page is used.

### Current India Razorpay checkout

- Checkout provider selection is controlled by `CHECKOUT_PROVIDER`.
- Razorpay credentials stay server-side.
- Checkout order creation validates the submitted cart/product variant IDs against Shopify.
- A Razorpay order is created only from server-calculated data.
- The Razorpay order ID is bound to the signed session.
- Payment verification validates the Razorpay signature and session order ID.
- The final Razorpay state is reconciled before a Shopify order is created or located.
- Webhook handling and idempotent reconciliation are present.
- Optional Shopify draft-order anchoring is supported.
- Checkout and reconciliation emit monitoring events and request correlation IDs.

### Deliberate international block

International payment is **not enabled in code yet**:

- The checkout UI requires `locale.country === 'IN'`.
- `POST /api/checkout/razorpay/order` rejects non-India markets with `UNSUPPORTED_MARKET`.
- Current amount conversion uses `inrToPaise`, so it must not receive USD or CAD amounts.
- Current checkout/reconciliation assumptions were designed for INR and must not be opened internationally by merely removing the country checks.

This block must remain until the requirements below are completed.

## Why Shopify must remain the pricing authority

The storefront must not calculate the US 120% adjustment itself. Shopify Markets already produces the contextual price. The server must retrieve or validate the selected variants/cart under the active buyer country and use the returned `MoneyV2.amount` and `currencyCode`.

Required invariant:

> The currency and amount shown to the customer, stored in the checkout snapshot, sent to Razorpay, verified after payment, used for analytics, and written into Shopify reconciliation must agree.

Never convert a Shopify USD/CAD presentment amount using `inrToPaise`. Introduce a currency-aware smallest-unit conversion utility based on the ISO currency exponent and an explicit allowlist.

## Prerequisites before implementation

### Legal and operational

- IEC obtained and verified for the business.
- Export tax/GST treatment reviewed with the accountant or compliance adviser.
- International invoice and customs-document requirements confirmed.
- Product export eligibility and destination restrictions confirmed.
- Duties/taxes policy decided: customer-paid versus merchant-paid where supported.
- Returns, refused shipments, damaged parcels, and chargeback procedures documented.

### Shopify Admin

- Canada and United States Markets enabled and tested.
- Products published and available in the applicable Markets and Headless channel.
- Market currency and price adjustments verified on representative variants.
- Shipping zones and rates configured for each destination.
- Taxes/duties configuration reviewed.
- Checkout/customer address requirements configured.
- Test carts verified to return `USD` for US and `CAD` for Canada.

### Razorpay Dashboard

- International payments fully approved for the live account after IEC/KYC review.
- Required international currencies enabled and confirmed through Razorpay support/dashboard.
- International cards/payment methods confirmed.
- Settlement currency, conversion, fees, refunds, disputes, and chargeback behavior documented.
- Webhook endpoint and required events configured for the production domain.
- Live and test credentials kept separate.

### Shiprocket

- International shipping activated on the Shiprocket account.
- Serviceability, courier selection, rate calculation, pickup location, package dimensions, HS codes, invoice data, and export documents configured.
- Shopify/Razorpay order data required by Shiprocket documented and mapped.
- Unsupported countries/postcodes blocked before payment.

## Planned implementation

### Phase 1: Market and cart integrity

- Confirm locale resolution from browser/edge country and explicit customer override.
- Persist explicit selection in the session and cart buyer identity.
- On cart creation as well as locale switching, set `buyerIdentity.countryCode`.
- Revalidate cart lines after a country change so prices, discounts, availability, and currency refresh from Shopify.
- Prevent mixed-market/stale-cart checkout.

### Phase 2: Currency-safe Razorpay order creation

- Remove the India-only gate only behind a disabled-by-default international feature flag.
- Add an allowlist such as `INR`, `USD`, and `CAD`, limited to currencies actually enabled in Razorpay.
- Replace `inrToPaise` with a currency-aware minor-unit converter.
- Read amount and currency exclusively from a server-fetched Shopify contextual cart/variant response.
- Reject client currency or amount inputs.
- Require every line and cart total to use the same expected currency.
- Send Razorpay both `amount` and `currency` from the validated server snapshot.
- Persist country, language, currency, contextual unit prices, discounts, shipping, taxes, and cart ID in the signed/reconcilable checkout snapshot.

### Phase 3: Address, shipping, duties, and tax

- Collect and validate the complete international billing/shipping address before creating the payment order.
- Check Shiprocket serviceability and obtain the final shipping charge before payment.
- Recalculate the Shopify/cart total after shipping selection.
- Display duty/tax responsibility clearly.
- Make the final payable total immutable between Razorpay order creation and verification.

### Phase 4: Verification and Shopify reconciliation

- Verify Razorpay signature as today.
- Fetch the Razorpay order/payment and verify captured/authorized state, exact amount, exact currency, and receipt/correlation metadata.
- Create the Shopify order with the correct presentment currency and market/customer/address context.
- Store Razorpay IDs, market, country, currency, exchange/settlement metadata, and checkout snapshot in Shopify order metadata/metafields.
- Preserve idempotency across browser verification and webhook retries.
- Do not mark an order paid or fulfil it if amount/currency reconciliation fails.

### Phase 5: Shiprocket fulfilment

- Send only verified Shopify orders to Shiprocket.
- Include destination address, line items, SKU, weight/dimensions, HS codes, declared value, invoice details, and payment status.
- Persist Shiprocket shipment/AWB identifiers back to Shopify.
- Handle serviceability failure before payment; operational failure after payment must enter a visible recovery queue.

### Phase 6: Controlled rollout

- Keep `IN` behavior unchanged.
- Enable one test market/currency at a time.
- Test Razorpay test mode, then controlled live low-value transactions after approval.
- Add monitoring by country, currency, order-creation stage, verification stage, webhook stage, Shopify reconciliation, and Shiprocket fulfilment.
- Provide an immediate feature-flag rollback to the current India-only block.

## Required test matrix

| Scenario | Expected result |
| --- | --- |
| India / INR | Existing Razorpay checkout remains unchanged |
| US locale / USD | Shopify-adjusted USD shown and the exact USD amount is charged |
| Canada English / CAD | Shopify CAD price shown and charged |
| Canada French / CAD | French Shopify content with the same CAD market price |
| Canadian visitor selects US | Cart buyer identity changes to US; USD price and US shipping rules apply |
| Locale changed with existing cart | Cart revalidated; stale currency cannot be checked out |
| Unsupported currency | Checkout blocked before Razorpay order creation |
| Unserviceable postcode | Checkout blocked before payment |
| Amount/currency mismatch | Verification/reconciliation fails safely; no paid Shopify order |
| Duplicate verification/webhook | One Shopify order only |
| Refund | Razorpay and Shopify records reconcile in the original charge currency |

## Go-live checklist

- [ ] IEC and required compliance work complete
- [ ] Shopify Markets, prices, channel publication, shipping, taxes, and duties verified
- [ ] Razorpay international currencies and live account approval confirmed
- [ ] Shiprocket international serviceability and documentation configured
- [ ] Currency-aware amount handling implemented and reviewed
- [ ] Server-side cart/variant price validation implemented
- [ ] International address and final shipping calculation implemented
- [ ] Exact amount/currency reconciliation implemented
- [ ] Shopify order presentment-currency behavior verified
- [ ] Webhook/idempotency tests passed
- [ ] End-to-end US and Canada test matrix passed
- [ ] Feature flag and rollback tested

## Files involved when work resumes

- `app/lib/i18n.ts`
- `app/lib/context.ts`
- `app/routes/locale.ts`
- `app/components/CartSummary.tsx`
- `app/components/ProductForm.tsx`
- `app/lib/checkout/checkout.client.ts`
- `app/lib/checkout/providers/razorpay/razorpay.ts`
- `app/lib/checkout/providers/razorpay/razorpay.client.ts`
- `app/lib/checkout/providers/razorpay/razorpay.server.ts`
- `app/lib/checkout/providers/razorpay/razorpay-order.server.ts`
- `app/routes/api.checkout.razorpay.order.ts`
- `app/routes/api.checkout.razorpay.verify.ts`
- `app/routes/webhooks.razorpay.ts`
- `app/routes/checkout.razorpay.success.tsx`

## Explicit non-goals until approval

- Do not remove the India-only payment checks.
- Do not treat a display currency conversion as a chargeable server amount.
- Do not enable international checkout using only browser-detected geography.
- Do not deploy or activate paid international transactions before IEC, Shopify, Razorpay, and Shiprocket readiness is confirmed.
