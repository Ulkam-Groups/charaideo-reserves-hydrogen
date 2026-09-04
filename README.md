# Assam Tea — Hydrogen storefront

## What is implemented

This is a Hydrogen storefront for individual, inventory-bearing teas and custom tea boxes. The blend engine limits a recipe to 1–10 teas, uses 5g increments, validates global and per-tea weight caps, and calculates the price from individual ingredient gram prices. A configured packaging charge can be included server-side.

The app is designed for real-shop local development and production deployment against Shopify. Storefront data, customer-account flows, and checkout redirects all use Shopify-hosted services, while product creation and inventory adjustments are executed only from secure server-side Admin API calls. No Admin token is exposed to browser code.

Custom blends use a server-created Shopify Draft Order and redirect to Shopify Checkout. This keeps the custom tea box price trustworthy and avoids building a custom checkout. Ingredient details are attached to the draft-order line and the order webhook deducts only the individual ingredient inventory (one Shopify inventory unit = one gram) after an order is created.

## Shopify configuration required

1. Create a custom app for the real store and install it. Give it the scopes in `shopify.app.toml`; copy its Admin API access token into `SHOPIFY_ADMIN_ACCESS_TOKEN`.
2. Create a Storefront API token and set `PUBLIC_STORE_DOMAIN`, `PUBLIC_STOREFRONT_API_TOKEN`, and `PRIVATE_STOREFRONT_API_TOKEN`.
3. Enable Customer Account API in Shopify Admin (Settings → Customer accounts). Configure its return URLs for localhost and your Oxygen domain. The UI includes a save flow; production customer identity must be passed from the Customer Account session before enabling it.
4. Select the inventory location and put its GID in `SHOPIFY_LOCATION_ID`. Set the custom-app webhook secret in `SHOPIFY_WEBHOOK_SECRET`.
5. In Shopify Admin, configure each tea product with metafields below. Its variant inventory quantity is grams.

| Metafield | Type | Example |
| --- | --- | --- |
| `tea.blend_eligible` | boolean | `true` |
| `tea.max_contribution_g` | number_integer | `50` |
| `tea.price_per_gram` | number_decimal | `1.25` |
| `tea.origin` | single_line_text_field | `Hapjan` |
| `tea.category` | single_line_text_field | `Black` |
| `tea.blend_min_g` | number_integer (store config / metaobject) | `50` |
| `tea.blend_max_g` | number_integer (store config / metaobject) | `200` |

For initial operation, set `BLEND_MIN_GRAMS`, `BLEND_MAX_GRAMS`, and `PACKAGING_PRICE` in Oxygen secrets; the server has safe defaults (50g, 200g, 0). Move these three global values into an Admin metaobject as the next configuration refinement.

## Local development against the real store

Copy `.env.example` to `.env`, fill in real values, then install packages and run the Shopify-aware local app:

```powershell
npm install
npm run dev
```

`npm run dev` runs the Hydrogen dev workflow against the configured Shopify store, so loaders query the actual shop and server-side actions mutate the real shop. Do not use production tokens in browser-visible variables. `npm run dev:local` is useful for UI-only work but does not register a webhook tunnel.

### Secure product configuration API

`POST /api/admin/teas` is server-side only and calls the live Admin GraphQL API. It requires `Authorization: Bearer $ADMIN_INTERNAL_TOKEN`; it accepts `id` (optional), `title`, `price`, `sku`, `blendEligible`, `maxContributionGrams`, and `pricePerGram`. In production, replace this temporary internal-token gate with Shopify app/session authentication before exposing a staff interface. The Admin token itself is never returned or used by browser code.

## Deploy to Oxygen

Set all values from `.env` in the Hydrogen/Oxygen environment-variable UI (or via the Shopify CLI), then run:

```powershell
npm run build
npm test
npm run typecheck
npm run deploy:oxygen
```

Set the deployed domain as the app URL and webhook destination. Send a test order, confirm the signed `orders/create` webhook succeeds, and inspect the order metafield `tea.inventory_adjusted_at` before enabling live sales.

## Tests

```powershell
pnpm test
```

The tests cover increment, distinct-item, total/min/max, per-item maximum, pricing, and ingredient inventory calculations.
