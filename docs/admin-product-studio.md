# Charaideo Product Studio

The `admin-site` branch contains a private, standalone admin surface at `/admin` while preserving the existing Hydrogen storefront. The admin route does not render storefront navigation, analytics, checkout scripts, Meta Pixel, or Shopify Chat, and its root loader skips storefront data requests.

Access control is expected to be enforced by the private Shopify admin environment in front of this application. The application does not add a second password prompt. All admin responses remain marked no-store, no-index, and deny framing.

## What it manages

- Paginated, searchable product catalog (50 products per page)
- Product title, handle, HTML description, vendor, type, status, tags, template suffix, SEO, and taxonomy category
- Variant price, compare-at price, SKU, barcode, tax flag, and inventory policy
- All existing product metafields plus the 29 Charaideo `custom.*` product-page fields from `Charaideo_Product_Metafields.postman_collection.json`
- One-click creation of missing Charaideo metafield definitions with public Storefront API read access

The save flow validates the complete form before writing. Shopify product, variant, and metafield mutations are separate API operations, so an upstream failure in a later section can occur after an earlier section succeeds; the UI reports this and tells the administrator to reload before retrying. Metafield writes use Shopify compare digests when available to prevent silently overwriting a newer metafield value.

## Required private environment variables

```text
SESSION_SECRET=<random value of at least 32 characters>
SHOPIFY_PRODUCT_ADMIN_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_PRODUCT_ADMIN_API_VERSION=2026-07
```

Choose one Admin API authentication method:

### Dev Dashboard client credentials

```text
SHOPIFY_PRODUCT_ADMIN_CLIENT_ID=<postman-charaideoreserves client id>
SHOPIFY_PRODUCT_ADMIN_CLIENT_SECRET=<postman-charaideoreserves client secret>
```

Use the existing Dev Dashboard app named `postman-charaideoreserves`. The app and store must be in the same Shopify organization. Its released and installed version must grant `write_products`; the version shown in Shopify already grants `read_products,write_products`. Obtain a new token after any scope change. Product metafield access follows the product resource permission.

### Long-lived custom app token

```text
SHOPIFY_PRODUCT_ADMIN_ACCESS_TOKEN=<server-only Admin API token>
```

Never use a `PUBLIC_` prefix for the client secret or access token. Never commit them. If both token styles are configured, `SHOPIFY_PRODUCT_ADMIN_ACCESS_TOKEN` takes precedence.

## Local use

1. Add the variables above to `.env`.
2. Run `npm run dev`.
3. Open `http://localhost:3000/admin` (or the URL printed by Hydrogen).
4. On first use, select **Set up metafield definitions**.

## Branch environment

Deploy the `admin-site` branch to its own access-controlled Oxygen environment and set its variables separately from production. The Product Studio reuses the existing `postman-charaideoreserves` app; it does not create or require another Shopify app configuration. Do not expose the environment URL publicly unless Shopify or the hosting layer is actually validating administrator access; merely hiding a URL is not access control.

Before treating the environment as production-ready, verify a test product end to end: load it, change one text field and one metafield, save, reload, and confirm the storefront reflects the value. Deployment and live Shopify authorization are intentionally not performed by source changes alone.
