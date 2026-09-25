# FastRR checkout provider

This folder contains all FastRR/Shiprocket-specific checkout code and configuration.

- `fastrr.ts` contains SSR-safe FastRR types and Shopify variant ID validation.
- `fastrr.client.ts` contains only the browser launch through `window.shiprocketCheckoutEvents.buyDirect`.
- `fastrr.config.ts` owns the FastRR SDK/style URLs and Content Security Policy sources.
- `PUBLIC_FASTRR_SELLER_DOMAIN` identifies the configured seller domain.
- `CHECKOUT_PROVIDER=fastrr` enables this provider. FastRR remains the default when `CHECKOUT_PROVIDER` is omitted.

Vendor-neutral SSR-safe validation is in `../../checkout.ts`; browser launching is in `../../checkout.client.ts`. Product and cart components must use those modules instead of importing this provider directly.

Unit coverage lives in `tests/fastrr.test.ts` and `tests/checkout-provider.test.ts`; browser coverage lives in `tests/e2e/storefront.spec.ts`.
