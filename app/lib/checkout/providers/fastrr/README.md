# FastRR checkout provider

This folder contains all FastRR/Shiprocket-specific checkout code and configuration.

- `fastrr.client.ts` converts Shopify variant GIDs to FastRR numeric IDs and launches `window.shiprocketCheckoutEvents.buyDirect`.
- `fastrr.config.ts` owns the FastRR SDK/style URLs and Content Security Policy sources.
- `PUBLIC_FASTRR_SELLER_DOMAIN` identifies the configured seller domain.
- `CHECKOUT_PROVIDER=fastrr` enables this provider. FastRR remains the default when `CHECKOUT_PROVIDER` is omitted.

The vendor-neutral dispatcher is `../../checkout.client.ts`. Product and cart components must call that dispatcher instead of importing this provider directly.

Unit coverage lives in `tests/fastrr.test.ts` and `tests/checkout-provider.test.ts`; browser coverage lives in `tests/e2e/storefront.spec.ts`.
