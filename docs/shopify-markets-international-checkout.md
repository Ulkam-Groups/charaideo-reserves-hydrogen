# Shopify Markets and Razorpay International Checkout

## Purpose

This document defines how Charaideo Reserves must configure, resolve, price, test,
and operate international storefront markets. Shopify Markets is the source of truth
for the buyer's country, product availability, currency, market price adjustment,
and localized `MoneyV2` values. The application must not reproduce Shopify's exchange
rate or percentage-adjustment calculations.

Razorpay Magic Checkout receives the final currency and amount returned by Shopify.
It is a payment and checkout consumer of Shopify's authoritative market price, not a
second pricing engine.

Apple Pay is outside the scope of this document.

## Desired outcome

The complete production flow is:

```text
Automatic country suggestion or customer country selection
  -> persisted ISO country code
  -> Hydrogen request i18n context
  -> Shopify Storefront API @inContext(country)
  -> Shopify Market-adjusted price and currency
  -> Shopify cart buyerIdentity.countryCode
  -> server-authoritative checkout price validation
  -> Razorpay order in the same currency and amount
  -> captured Razorpay payment
  -> Shopify order in the same presentment currency and amount
```

For example:

```text
India          -> India Market          -> INR price
United States  -> United States Market  -> USD price with the configured +12% adjustment
Canada         -> Canada Market         -> CAD price with the configured +90% adjustment
Germany        -> Europe Market         -> EUR price with the configured adjustment
```

The percentages above are examples of current merchant configuration. Shopify applies
the configured conversion, adjustment, and rounding. Application code must use the
resulting `amount` and `currencyCode` exactly as returned.

## Ownership boundaries

| Concern | Owner |
| --- | --- |
| Enabled countries and regions | Shopify Markets |
| Currency assigned to a country | Shopify Markets |
| Automatic conversion or fixed market prices | Shopify Markets |
| Percentage price adjustments | Shopify Markets |
| Product publication per market | Shopify Markets |
| Customer-selected country | Hydrogen storefront |
| Persisted market preference | Hydrogen first-party cookie |
| Cart buyer country | Shopify Storefront Cart API |
| Checkout amount validation | Hydrogen server |
| Payment order and capture | Razorpay |
| Final order reconciliation | Hydrogen, Razorpay, and Shopify Admin API |

## Current repository status

### Implemented

- `app/lib/markets.ts` reads Oxygen's trusted `oxygen-buyer-country` header, validates
  the two-letter country code, and defaults to `IN`.
- The resolved country is passed to the Hydrogen Storefront API client as its `i18n`
  context.
- Storefront queries that declare `$country` and use `@inContext` receive contextual
  Shopify Market data.
- The Razorpay checkout order route reads authoritative Shopify `MoneyV2` amounts and
  currency codes.
- Razorpay orders are created in the Shopify-returned currency rather than being forced
  to INR.
- Currency conversion into Razorpay subunits supports zero-, two-, and three-decimal
  currencies from Razorpay's supported international-currency list.
- Verification requires the Razorpay order, captured payment, Shopify Draft Order,
  and completed Shopify order to agree on currency and amount.
- Existing INR checkout follows the same validation path and remains supported.

### Not yet implemented

- A customer-facing country/region selector.
- A first-party cookie containing the customer's explicit country choice.
- Resolver precedence of explicit preference over IP geolocation.
- `cartBuyerIdentityUpdate` when the customer changes country.
- A visible indication when changing country will reprice the cart.
- Browser testing of USD, CAD, EUR, and GBP without using a VPN.
- Live or staging evidence proving that each configured market produces the expected
  Razorpay and Shopify orders.

Repository code or automated tests alone are not evidence that dashboard configuration,
deployment environment variables, Shopify Markets, or Razorpay live entitlements are
correct.

## Shopify Markets configuration

Configure every selling region in **Shopify Admin -> Settings -> Markets**.

For each market:

1. Create or select the market.
2. Add the intended countries.
3. Activate the market.
4. Confirm the market currency.
5. Publish the applicable products to the market.
6. Configure automatic currency conversion, percentage adjustment, or fixed prices.
7. Configure rounding rules.
8. Confirm shipping zones, rates, duties, and taxes.
9. Confirm that policies and delivery expectations cover the destination country.
10. Preview representative products in that market.

Recommended initial market matrix:

| Market | Country context | Expected currency | Pricing source |
| --- | --- | --- | --- |
| India | `IN` | `INR` | Base catalog price |
| United States | `US` | `USD` | Shopify conversion/price plus configured adjustment |
| Canada | `CA` | `CAD` | Shopify conversion/price plus configured adjustment |
| Europe | `DE`, `FR`, and other enabled countries | `EUR` | Shopify conversion/price plus configured adjustment |
| United Kingdom | `GB` | `GBP` | Shopify conversion/price plus configured adjustment |

Do not assume that a market name determines currency. Verify the currency returned by
Shopify for every enabled country. Canada should normally produce CAD, not USD, unless
the Shopify Market has deliberately been configured otherwise.

### Percentage adjustments versus fixed prices

When using a percentage adjustment, Shopify starts from its configured base price and
conversion behavior, applies the market adjustment, and applies its rounding rules.
The resulting price may not equal a simple calculation performed later with a different
exchange rate.

When exact retail prices are required, use Shopify's fixed market prices where supported.
The storefront and Razorpay integration behave the same way in either case because both
consume the final Shopify `MoneyV2` value.

## Industry-standard market selection

Use automatic IP geolocation only as the initial suggestion. A customer's explicit
selection must take precedence because customers travel, use corporate networks, send
gifts, and deliberately shop for another destination.

Recommended resolution priority:

```text
1. Valid customer-selected country stored in a first-party cookie
2. Valid Oxygen buyer-country geolocation
3. Default country IN
```

The selector should say **Country/region** or **Deliver to**, not merely **Currency**.
Shopify pricing, product availability, tax, shipping, and checkout eligibility are
country-contextual. A raw currency selector such as `?currency=USD` is insufficient.

The selector's options must come from Shopify's `localization.availableCountries`.
Do not maintain an unrelated hard-coded list that can drift from Shopify Admin.

## Country selector implementation requirements

### Read available countries

Query Shopify Storefront API localization data and display only enabled countries:

```graphql
query StoreLocalization(
  $country: CountryCode
  $language: LanguageCode
) @inContext(country: $country, language: $language) {
  localization {
    country {
      isoCode
      name
      currency {
        isoCode
      }
    }
    availableCountries {
      isoCode
      name
      currency {
        isoCode
      }
    }
  }
}
```

### Persist the selection

Store only an allowlisted ISO 3166-1 alpha-2 code such as `US`, `CA`, or `DE` in a
first-party cookie. Recommended properties:

```text
Path=/
SameSite=Lax
Secure in HTTPS environments
Long but finite Max-Age
```

The server must validate the cookie against Shopify's available countries. Never trust
an arbitrary cookie, query parameter, or browser-supplied currency.

### Resolve the Hydrogen context

Extend `resolveStorefrontI18n(request)` so that a validated saved preference precedes
`oxygen-buyer-country`, while preserving `IN` as the fallback. Resolve this once at the
request boundary and pass it to `createShopifyRequestContext()`.

Every price-bearing Storefront API query must declare `$country` and `$language` and
apply:

```graphql
@inContext(country: $country, language: $language)
```

Application code must render the returned `MoneyV2.amount` and
`MoneyV2.currencyCode`. It must not locally convert INR into USD, CAD, EUR, or GBP.

### Update the cart buyer identity

When a customer changes country and a cart exists, update it with
`cartBuyerIdentityUpdate`:

```graphql
mutation UpdateCartCountry(
  $cartId: ID!
  $buyerIdentity: CartBuyerIdentityInput!
) {
  cartBuyerIdentityUpdate(
    cartId: $cartId
    buyerIdentity: $buyerIdentity
  ) {
    cart {
      id
      buyerIdentity {
        countryCode
      }
      cost {
        totalAmount {
          amount
          currencyCode
        }
      }
    }
    userErrors {
      field
      message
    }
    warnings {
      code
      message
    }
  }
}
```

Variables example:

```json
{
  "cartId": "gid://shopify/Cart/...",
  "buyerIdentity": {
    "countryCode": "US"
  }
}
```

The buyer country should eventually agree with the shipping address. If the selected
country and submitted delivery country differ, the user must be asked to confirm the
market change and the cart must be repriced before payment.

After changing country:

1. Update the persisted country.
2. Update cart buyer identity.
3. Handle GraphQL top-level `errors`, mutation `userErrors`, and `warnings` separately.
4. Reload market-aware product and cart data.
5. Show the new total and currency.
6. Inform the customer that price, availability, shipping, and tax may have changed.
7. Do not retain a stale checkout order from the previous market.

If cart repricing cannot be completed safely, clear/recreate the cart only after clear
customer confirmation. Silently mixing old-market cart data with a new market is not
acceptable.

## Razorpay Magic Checkout handoff

The checkout server must treat Shopify as authoritative:

1. Fetch the cart or variants using the active Shopify country context.
2. Read `amount` and `currencyCode` from Shopify `MoneyV2` fields.
3. Require all checkout lines to use one currency.
4. Validate that the currency is supported by Razorpay.
5. Convert the decimal amount into the correct currency subunit representation.
6. Create the Razorpay order with the same currency.
7. Open `magic-checkout.js` with the returned server-created order ID.
8. Never trust a price or currency posted directly by the browser.

Example:

```text
Shopify US price:       USD 13.49
Razorpay order amount:  1349
Razorpay currency:      USD
```

For a zero-decimal currency such as JPY, no factor of 100 is applied. For a
three-decimal currency, Razorpay's published rules must be followed. These details are
handled by the shared currency utilities and must not be replaced with a universal
`amount * 100` calculation.

## Payment verification and reconciliation

A successful browser callback is not proof of payment. Before completing a Shopify
order, the server must:

1. Verify the Razorpay signature.
2. Fetch the Razorpay order from Razorpay.
3. Fetch the Razorpay payment.
4. Require the expected Razorpay order ID.
5. Require a paid order and captured payment.
6. Require order and payment currencies to match.
7. Require order and payment amounts to match.
8. Require the server session/Draft Order anchor to match.
9. Require the Shopify Draft Order recalculated total and presentment currency to match.
10. Complete or locate exactly one Shopify order.

Any currency mismatch must fail closed. The application must never silently convert or
repair a mismatch after payment.

## Browser testing without a VPN

Once the country selector is implemented, use a normal browser:

1. Open a fresh Incognito window.
2. Select **United States**.
3. Confirm product and cart prices show USD.
4. Add the product after selecting the country.
5. Start Magic Checkout in Razorpay Test Mode.
6. Complete a test payment using an official Razorpay international test card.
7. Verify the Razorpay Test order and payment.
8. Verify the Shopify Draft Order and completed order.
9. Repeat for Canada and a Eurozone country.
10. Switch back to India and run the existing INR flow.

Expected market assertions:

```text
US selection -> Shopify USD -> Razorpay USD -> Shopify order USD
CA selection -> Shopify CAD -> Razorpay CAD -> Shopify order CAD
DE selection -> Shopify EUR -> Razorpay EUR -> Shopify order EUR
IN selection -> Shopify INR -> Razorpay INR -> Shopify order INR
```

### What to verify in Razorpay Test Dashboard

- The latest order has the expected currency.
- The amount uses the correct currency subunits.
- The payment belongs to that order.
- The payment currency and amount match the order.
- The successful payment is captured.
- An international test card is reported as international when Razorpay exposes that
  field in the test transaction.

### What to verify in Shopify Admin

- Exactly one order is created.
- The order uses the expected presentment currency.
- Line prices reflect the configured Shopify Market adjustment or fixed price.
- The order total agrees with Razorpay.
- Shipping and customer destination are correct.
- Retrying or replaying confirmation does not create a duplicate order.

Use a staging/dev Shopify store where possible. Razorpay Test Mode does not move real
money, but this integration can still create a Shopify order and trigger email,
inventory, fulfillment, analytics, or Shiprocket automation.

## Required test matrix

| Scenario | Expected outcome |
| --- | --- |
| India/INR prepaid success | Captured payment and one INR Shopify order |
| US/USD prepaid success | Adjusted USD price, captured payment, one USD order |
| Canada/CAD prepaid success | Adjusted CAD price, captured payment, one CAD order |
| Europe/EUR prepaid success | Adjusted EUR price, captured payment, one EUR order |
| Unsupported country | Valid configured fallback or a controlled rejection |
| Product unavailable in selected market | Product/checkout unavailable before payment |
| Mixed-currency lines | Checkout rejected before Razorpay order creation |
| Country changed with existing cart | Cart repriced and customer informed |
| Shipping country differs from selected market | Reconfirm market and reprice before payment |
| Failed payment | No paid Shopify order |
| Customer closes checkout | Cart remains usable; no paid order |
| Callback replay | Existing order returned; no duplicate |
| Browser callback lost after capture | Signed recovery webhook converges on one order |
| Existing INR checkout | No pricing or reconciliation regression |

## Automated test requirements

Maintain unit/integration coverage for:

- Cookie, Oxygen header, and India fallback precedence.
- Invalid and `XX` country handling.
- Shopify `@inContext` variables on price-bearing checkout queries.
- Cart buyer identity updates and error handling.
- Market-switch cart repricing.
- Supported and unsupported currencies.
- Zero-, two-, and three-decimal currency conversion.
- Mixed-currency rejection.
- Razorpay order currency propagation.
- Payment/order/draft/final-order currency mismatch rejection.
- INR regression behavior.
- Idempotent browser and webhook reconciliation.

Run at minimum:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Use the repository's actual targeted test commands if `npm test` is split into unit and
integration suites.

## PR 67 review decision (testing phase)

The application is not live yet and is still running in testing mode. There are no
production orders or in-flight legacy Razorpay payments to migrate or preserve.
Therefore, legacy-order compatibility is not a merge requirement when this work is
resumed. The supported launch path is the Shopify Draft Order anchored flow.

### Required checkout sequence

`RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED` must be set to `true` in every environment used
to test or launch international checkout. With the flag enabled, the expected sequence
is:

1. Resolve the Shopify Market and retrieve Shopify's contextual price and currency.
2. Create the Shopify Draft Order first.
3. Create the Razorpay order using the Draft Order's recalculated total and currency.
4. Store the Shopify Draft Order ID in the server-authored Razorpay order notes.
5. Verify the Razorpay signature and fetch the authoritative order and payment.
6. Require the Razorpay amount and currency to match the Shopify Draft Order.
7. Complete the Draft Order exactly once after the payment is captured and reconciled.

For a new non-INR checkout, the application should fail closed if Draft Order anchoring
is disabled or unavailable. It must not silently use the legacy direct-order fallback.
The fallback may be removed in a later cleanup because the application has not launched,
but removing it is outside the scope of the current international-payment changes.

### Work required before this PR is resumed for merge

- Correct or reject three-decimal amounts that Razorpay cannot represent. In particular,
  do not send an arbitrary third decimal digit: where Razorpay requires the last subunit
  digit to be zero, an amount such as `KWD 295.991` must not be sent as `295991`.
- Add a complete USD automated integration test covering Shopify Draft Order creation,
  Razorpay order creation, captured-payment verification, amount/currency reconciliation,
  and Draft Order completion. Existing INR-only Draft Order mocks are not sufficient
  evidence for the international path.
- Keep `RAZORPAY_DRAFT_ORDER_ANCHOR_ENABLED=true` in staging and production configuration
  for international checkout.
- Run an end-to-end Razorpay Test Mode transaction from a Shopify Market priced in USD
  or EUR, then verify the Draft Order, Razorpay order/payment, and final Shopify order all
  have the same amount and currency.
- Re-run the browser E2E suite with the project's supported Node version. The review run
  did not execute browser tests because the Miniflare Workers runtime failed to start on
  Node `24.20.0`; this was an environment/runtime failure, not a passing E2E result.

Until these items are complete, the multi-currency architecture is suitable for further
testing, but this PR should not be treated as regression-safe for launch or merge.

## Rollout plan

1. Complete Shopify Markets configuration and record expected sample prices.
2. Implement the country selector, validated cookie, and cart buyer identity update.
3. Add automated tests for selection and cart repricing.
4. Deploy to staging with Razorpay Test keys.
5. Test INR, USD, CAD, and EUR end to end.
6. Confirm no email, fulfillment, or logistics automation can escape staging.
7. Deploy the selector behind a reversible feature flag if production risk warrants it.
8. Run a low-value production transaction for each priority market with an authorized
   real card and customer destination.
9. Confirm Razorpay capture, Shopify order currency, inventory, notification, and
   fulfillment behavior.
10. Record evidence and request IDs without storing secrets, signatures, full payment
    identifiers, or customer personal data in logs.

Rollback should disable the explicit selector and return to the existing IP-geolocation
plus India-fallback resolver. It must not revert the safe server-side multi-currency
validation while international orders remain in flight.

## Troubleshooting

### The selected US market still shows INR

Check:

- The US market is active.
- USD is enabled for the market.
- The product is published to that market.
- The request resolver returns `US`.
- The query declares `$country` and uses `@inContext`.
- An existing cart buyer identity is not still set to `IN`.
- Cached pages or an old cart are not being reused.

If a country is not enabled, Shopify may fall back to the store currency.

### Product page shows USD but cart or checkout shows INR

The product query and cart buyer identity are using different country contexts. Update
the cart with `cartBuyerIdentityUpdate`, reload it, and create the Razorpay order only
from the repriced server-side cart.

### Canada does not show the expected +90% result

Confirm whether the setting is a percentage adjustment or fixed price, whether it is
attached to the active Canada market, whether Canada uses CAD, and whether Shopify's
conversion and rounding are producing the observed final value. Compare the storefront
response to Shopify's market preview; do not compare Razorpay against a manual INR
calculation using a different exchange rate.

### Razorpay rejects the currency

Confirm that the currency is enabled for the Razorpay merchant and appears in Razorpay's
current supported international-currency list. Shopify supporting a currency does not
automatically activate it on Razorpay.

### Razorpay order is correct but Shopify final order mismatches

Stop fulfillment. Inspect the Draft Order presentment currency, server-authored anchor,
shipping/COD fees, and final reconciliation logs. Do not manually force completion or
convert the recorded payment into another currency.

## Security and data integrity rules

- Never expose Razorpay key secrets or Shopify Admin credentials to the browser.
- Never accept browser-submitted price, adjustment, or currency as authoritative.
- Allowlist country codes against Shopify localization data.
- Verify Razorpay signatures server-side.
- Fetch authoritative Razorpay order/payment state before fulfillment.
- Fail closed on amount, currency, cart, or Draft Order mismatches.
- Do not log customer address, phone, email, signatures, credentials, or full provider
  identifiers.
- Preserve idempotency across browser callbacks, retries, and webhooks.

## Official references

- [Shopify: Support multiple markets in Hydrogen](https://shopify.dev/docs/storefronts/hydrogen/markets)
- [Shopify: International pricing with the Storefront API](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/markets/international-pricing)
- [Shopify: Contextual Storefront API queries](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/in-context)
- [Shopify: Localization object](https://shopify.dev/docs/api/storefront/latest/objects/Localization)
- [Shopify: Cart buyer identity update](https://shopify.dev/docs/api/storefront/latest/mutations/cartBuyerIdentityUpdate)
- [Razorpay: International payments](https://razorpay.com/docs/payments/international-payments/)
- [Razorpay: Payment Gateway test integration and international test cards](https://razorpay.com/docs/payments/server-integration/python/integration-steps)

