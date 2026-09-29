# Product page Shopify data setup

The Hydrogen product page reads the fields below from the Shopify Storefront API. Create each definition in **Shopify Admin → Settings → Custom data → Products**, then enable storefront access for the definition.

Use namespace `custom` exactly. The key and type must also match this table.

## Required editorial fields

| Admin name | Namespace and key | Shopify type | Expected value |
| --- | --- | --- | --- |
| Roast | `custom.roast` | Integer | `0`–`5` |
| Body | `custom.body` | Integer | `0`–`5` |
| Sweetness | `custom.sweetness` | Integer | `0`–`5` |
| Astringency | `custom.astringency` | Integer | `0`–`5` |
| Caffeine score | `custom.caffeine_score` | Integer | `0`–`5` |
| Bitterness | `custom.bitterness` | Integer | `0`–`5` |
| Best time | `custom.best_time` | Single line text | Example: `Evening` |
| Milk pairing | `custom.milk_pairing` | Single line text | Example: `Excellent` |
| Tasting notes | `custom.tasting_notes` | List of single line text | Example: toasted rice, brown sugar, hazelnut |
| Character summary | `custom.character_summary` | Multi-line text | Short explanation of the cup character |
| Hot recipe | `custom.recipe_hot` | JSON | Recipe object described below |
| Iced recipe | `custom.recipe_iced` | JSON | Recipe object described below |
| Latte recipe | `custom.recipe_latte` | JSON | Recipe object described below |
| Process | `custom.process` | Single line text | Example: `Pan-roasted` |
| Tea style | `custom.tea_style` | Single line text | Example: `Hojicha` |
| Lot number | `custom.lot_number` | Single line text | Example: `CR-HOJ-01` |
| You will love this tea if | `custom.is_this_tea_yes` | List of single line text | One reason per list item |
| This tea may not suit you if | `custom.is_this_tea_no` | List of single line text | One reason per list item |
| Why we chose this tea | `custom.why_choose_tea` | Multi-line text | Curator/founder quote without quotation marks |
| Quote attribution | `custom.why_choose_attribution` | Single line text | Example: `Kamalika · Founder, Charaideo Reserves` |

For all six score definitions, add minimum `0` and maximum `5` validations in Shopify Admin.

## Existing record fields used by the page

| Admin name | Namespace and key | Shopify type |
| --- | --- | --- |
| Origin | `custom.origin` | Single line text |
| Estate | `custom.estate` | Single line text |
| Cultivar | `custom.cultivar` | Single line text |
| Grade | `custom.grade` | Single line text |
| Harvest | `custom.harvest` | Single line text |
| Flush | `custom.flush` | Single line text |
| Pluck date | `custom.pluck_date` | Date |
| Ingredients | `custom.ingredients` | List of single line text |
| Net weight | `custom.net_weight` | Weight |

The record also uses Shopify's standard product and category data:

- **Category** supplies the “Shopify category” value and is the fallback for tea type.
- **Product type** is the next fallback for tea type.
- **Variant SKU** supplies SKU.
- A product option named Size, Weight, or Pack supplies the available pack sizes.
- When the assigned Tea category exposes them, `shopify.tea-variety`, `shopify.tea-input-type`, and `shopify.taste-profile` category metafields supply Tea type, Tea format, and Taxonomy taste profile. These are read as taxonomy metaobject labels.

Set the product's category under its **Product organization** panel, then fill the available category metafields on the product. Shopify taxonomy/category attributes are represented as product metafields in the Storefront API. Their availability depends on the assigned category, so the page treats them as optional and retains the stable `custom.*` fallbacks.

## Recipe JSON format

Use this same shape for all three recipe metafields:

```json
{
  "title": "Hot Hojicha",
  "description": "Warm, rounded and quietly roasted. A simple evening cup.",
  "items": [
    {"label": "Tea", "value": "1.5 tsp"},
    {"label": "Water", "value": "200 ml"},
    {"label": "Temperature", "value": "85–90°C"},
    {"label": "Steep", "value": "2 minutes"},
    {"label": "Re-steep", "value": "1×"}
  ]
}
```

## Storefront access

Every definition queried by Hydrogen must have Storefront API access set to **Public read**. For API-created definitions, the current Admin GraphQL input is:

```graphql
access: {storefront: PUBLIC_READ}
```

The storefront only reads these fields. It does not create or update product metafields.

To resolve category metafield labels, enable **Metaobjects** in the Hydrogen/Headless Storefront API permissions. If it is unavailable, the separate category-attribute request fails safely and the product page continues with custom metafields and standard product data.

## Missing data behavior

- Missing scores show “Not set” with an empty meter.
- Missing record values show “Not yet provided”.
- Missing recipe JSON keeps the relevant tab visible and shows a short coming-soon message.
- The character summary falls back to the Shopify product description.

This keeps the page usable while products are populated without inventing tea facts.
