# Request 03: Set product page metafield values

This document captures the exact Shopify Admin GraphQL request used to populate the product-page metafields for Charaideo Reserves entries. It is intended to be used alongside the Postman collection in [Charaideo_Product_Metafields.postman_collection.json](./Charaideo_Product_Metafields.postman_collection.json) and the field definition document in [product-page-metafields.md](./product-page-metafields.md).

## Prerequisites

Before running request 03:

1. Set the collection variable `product_handle` to the target product handle.
2. Run request 01 to resolve `product_gid`.
3. Ensure request 02 has created the `custom.*` metafield definitions with Storefront access set to `PUBLIC_READ`.
4. Use a Shopify Admin API token that includes `write_products`.

## Mutation

This is the exact GraphQL mutation from the Postman collection:

```graphql
mutation SetAllProductPageMetafields($editorial: [MetafieldsSetInput!]!, $teaRecord: [MetafieldsSetInput!]!) {
  editorial: metafieldsSet(metafields: $editorial) {
    metafields { id namespace key type value updatedAt }
    userErrors { field message code }
  }
  teaRecord: metafieldsSet(metafields: $teaRecord) {
    metafields { id namespace key type value updatedAt }
    userErrors { field message code }
  }
}
```

## Variable format

Use the Shopify Admin API endpoint:

```text
https://{{shop}}/admin/api/{{admin_api_version}}/graphql.json
```

The variable payload follows this pattern:

```json
{
  "editorial": [
    {"ownerId": "{{product_gid}}", "namespace": "custom", "key": "roast", "type": "number_integer", "value": "4"},
    {"ownerId": "{{product_gid}}", "namespace": "custom", "key": "body", "type": "number_integer", "value": "5"}
  ],
  "teaRecord": [
    {"ownerId": "{{product_gid}}", "namespace": "custom", "key": "origin", "type": "single_line_text_field", "value": "Assam, India"},
    {"ownerId": "{{product_gid}}", "namespace": "custom", "key": "net_weight", "type": "weight", "value": "{\"value\":50,\"unit\":\"GRAMS\"}"}
  ]
}
```

### Important implementation notes

- `ownerId` must be the Shopify Product GID returned by request 01.
- `namespace` is always `custom`.
- `type` must match the exact Shopify metafield definition.
- For list fields, the `value` must be a JSON string array, for example:

```json
"[\"Malt\",\"Caramel\",\"Toasted grain\",\"Cocoa\"]"
```

- For JSON fields, the value must be a valid JSON object serialized as a string:

```json
"{\"title\":\"Hot Assam CTC\",\"description\":\"A brisk, malty cup.\",\"items\":[{\"label\":\"Tea\",\"value\":\"1 tsp\"}]}"
```

- Shopify accepts at most roughly 25 set inputs per metafieldsSet mutation. The collection splits values into two arrays: `editorial` and `teaRecord`.
- Both operations are executed independently; the collection validates each alias separately.

## Product examples used in this project

### 1. Ceremonial Reserve - Matcha Assamica | India’s First Matcha

Product handle:

```text
ceremonial-reserve-matcha-assamica-powder-indias-first-matcha
```

Recommended request 03 payload:

```json
{
  "editorial": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"roast","type":"number_integer","value":"1"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"body","type":"number_integer","value":"4"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"sweetness","type":"number_integer","value":"3"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"astringency","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"caffeine_score","type":"number_integer","value":"4"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"bitterness","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"best_time","type":"single_line_text_field","value":"Morning"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"milk_pairing","type":"single_line_text_field","value":"Excellent"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tasting_notes","type":"list.single_line_text_field","value":"[\"Fresh greens\",\"Sweet grass\",\"Umami\",\"Soft vegetal sweetness\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"character_summary","type":"multi_line_text_field","value":"A finely milled Assamica green tea powder with a fresh, vegetal character, rounded umami and a lingering green-tea finish."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_hot","type":"json","value":"{\"title\":\"Hot Assamica Matcha\",\"description\":\"A smooth, vibrant whisked cup.\",\"items\":[{\"label\":\"Matcha\",\"value\":\"2 g (about 1 tsp)\"},{\"label\":\"Water\",\"value\":\"60 ml\"},{\"label\":\"Temperature\",\"value\":\"75–80°C\"},{\"label\":\"Method\",\"value\":\"Sift, add water and whisk until smooth and lightly frothy\"},{\"label\":\"Serve\",\"value\":\"Drink as is or top with more water\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_iced","type":"json","value":"{\"title\":\"Iced Assamica Matcha\",\"description\":\"Bright, refreshing matcha served over ice.\",\"items\":[{\"label\":\"Matcha\",\"value\":\"2 g (about 1 tsp)\"},{\"label\":\"Water\",\"value\":\"60 ml\"},{\"label\":\"Temperature\",\"value\":\"75–80°C\"},{\"label\":\"Method\",\"value\":\"Sift and whisk until smooth, then pour over ice\"},{\"label\":\"Serve\",\"value\":\"Top with cold water or milk\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_latte","type":"json","value":"{\"title\":\"Assamica Matcha Latte\",\"description\":\"A creamy latte that balances matcha's fresh green character.\",\"items\":[{\"label\":\"Matcha\",\"value\":\"2 g (about 1 tsp)\"},{\"label\":\"Water\",\"value\":\"60 ml at 75–80°C\"},{\"label\":\"Milk\",\"value\":\"180 ml, steamed or cold\"},{\"label\":\"Sweetener\",\"value\":\"Optional, to taste\"},{\"label\":\"Method\",\"value\":\"Sift and whisk matcha with water, then add milk\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"process","type":"single_line_text_field","value":"Finely milled green tea"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tea_style","type":"single_line_text_field","value":"Assamica green tea powder"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"lot_number","type":"single_line_text_field","value":"REPLACE WITH ACTUAL LOT NUMBER"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_yes","type":"list.single_line_text_field","value":"[\"You enjoy fresh, vegetal green-tea flavours\",\"You like whisked tea with a creamy texture\",\"You want a versatile powder for tea or lattes\",\"You are curious to try Assamica as a matcha-style powder\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_no","type":"list.single_line_text_field","value":"[\"You prefer bold, malty black tea\",\"You want a delicate, lightly flavoured infusion\",\"You dislike vegetal or umami notes\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_tea","type":"multi_line_text_field","value":"We chose this Assamica green tea powder to explore a distinctive expression of Assam: finely milled and whisked rather than brewed as a conventional leaf tea."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_attribution","type":"single_line_text_field","value":"Kamalika · Founder, Charaideo Reserves"}
  ],
  "teaRecord": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"origin","type":"single_line_text_field","value":"Assam, India"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"estate","type":"single_line_text_field","value":"REPLACE WITH ACTUAL ESTATE"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"cultivar","type":"single_line_text_field","value":"Camellia sinensis var. assamica"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"grade","type":"single_line_text_field","value":"Ceremonial matcha"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"ingredients","type":"list.single_line_text_field","value":"[\"Assamica green tea powder\"]"}
  ]
}
```

### 2. Emerald Reserve - Gunpowder Green Loose Leaf | Single Estate Reserves

Product handle:

```text
assam-green-tea-gun-powder
```

Recommended request 03 payload:

```json
{
  "editorial": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"roast","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"body","type":"number_integer","value":"3"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"sweetness","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"astringency","type":"number_integer","value":"1"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"caffeine_score","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"bitterness","type":"number_integer","value":"1"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"best_time","type":"single_line_text_field","value":"Afternoon"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"milk_pairing","type":"single_line_text_field","value":"Best enjoyed without milk"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tasting_notes","type":"list.single_line_text_field","value":"[\"Steamed spinach\",\"Toasted nuts\",\"Light smoke\",\"Clean finish\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"character_summary","type":"multi_line_text_field","value":"Pan-fired Assam green tea, hand-rolled into small pearls that slowly unfurl as they steep. Smooth, vegetal and slightly nutty, with a clean finish."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_hot","type":"json","value":"{\"title\":\"Hot Gunpowder Green Tea\",\"description\":\"A smooth, fresh cup with a clean finish. Keep the water below boiling to avoid bitterness.\",\"items\":[{\"label\":\"Tea\",\"value\":\"1 tsp\"},{\"label\":\"Water\",\"value\":\"150 ml\"},{\"label\":\"Temperature\",\"value\":\"80°C\"},{\"label\":\"Steep\",\"value\":\"60–90 seconds\"},{\"label\":\"Re-steep\",\"value\":\"Re-steep the leaves twice, adding 15 seconds each time\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_iced","type":"json","value":"{\"title\":\"Iced Gunpowder Green Tea\",\"description\":\"A suggested iced preparation that keeps the tea fresh and light.\",\"items\":[{\"label\":\"Tea\",\"value\":\"2 tsp\"},{\"label\":\"Water\",\"value\":\"150 ml\"},{\"label\":\"Temperature\",\"value\":\"80°C\"},{\"label\":\"Steep\",\"value\":\"90 seconds\"},{\"label\":\"Serve\",\"value\":\"Strain over a glass of ice; adjust strength to taste\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_latte","type":"json","value":"{\"title\":\"Gunpowder Green Tea Latte\",\"description\":\"A suggested preparation; try a small test batch to check that it suits the tea's vegetal character.\",\"items\":[{\"label\":\"Tea\",\"value\":\"2 tsp\"},{\"label\":\"Water\",\"value\":\"100 ml at 80°C\"},{\"label\":\"Steep\",\"value\":\"90 seconds, then strain\"},{\"label\":\"Milk\",\"value\":\"100 ml, steamed or cold\"},{\"label\":\"Method\",\"value\":\"Combine the strained tea and milk; sweeten only if desired\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"process","type":"single_line_text_field","value":"Pan-fired and hand-rolled"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tea_style","type":"single_line_text_field","value":"Gunpowder green tea"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_yes","type":"list.single_line_text_field","value":"[\"You enjoy smooth, vegetal green tea\",\"You like slightly nutty notes and a clean finish\",\"You want a tea that can be re-steeped\",\"You prefer a lighter afternoon cup\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_no","type":"list.single_line_text_field","value":"[\"You prefer bold, malty black tea\",\"You want a strongly sweet or floral cup\",\"You usually brew green tea with boiling water\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_tea","type":"multi_line_text_field","value":"We chose this tea for its distinctive Assamica character and careful pan-firing. The hand-rolled pearls unfurl gradually, giving a smooth, vegetal and slightly nutty cup when brewed at the right temperature."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_attribution","type":"single_line_text_field","value":"Kamalika · Founder, Charaideo Reserves"}
  ],
  "teaRecord": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"origin","type":"single_line_text_field","value":"Chota Tingrai Estate, Assam, India"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"estate","type":"single_line_text_field","value":"Chota Tingrai Estate"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"cultivar","type":"single_line_text_field","value":"Camellia sinensis var. assamica"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"grade","type":"single_line_text_field","value":"Gunpowder green tea"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"ingredients","type":"list.single_line_text_field","value":"[\"100% green tea\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"net_weight","type":"weight","value":"{\"value\":100,\"unit\":\"GRAMS\"}"}
  ]
}
```

### 3. Heritage Reserve - Orthodox Black - TGFOP1 Whole Leaf | Single Estate Reserve

Product handle:

```text
assam-orthodox-black-tea-tgfop1-whole-leaf-single-estate-reserve
```

Recommended request 03 payload:

```json
{
  "editorial": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"roast","type":"number_integer","value":"1"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"body","type":"number_integer","value":"3"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"sweetness","type":"number_integer","value":"3"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"astringency","type":"number_integer","value":"2"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"caffeine_score","type":"number_integer","value":"4"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"bitterness","type":"number_integer","value":"1"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"best_time","type":"single_line_text_field","value":"Morning"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"milk_pairing","type":"single_line_text_field","value":"Optional; best enjoyed without milk"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tasting_notes","type":"list.single_line_text_field","value":"[\"Malt\",\"Light honey\",\"Sweet mellow finish\",\"Bright cup\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"character_summary","type":"multi_line_text_field","value":"A bright orange cup made from well-twisted orthodox whole leaf with a fair amount of tips. Sweet and mellow, with notes of malt and light honey."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_hot","type":"json","value":"{\"title\":\"Hot Orthodox Black Tea\",\"description\":\"A bright, mellow cup that brings out the leaf's malt and light honey notes.\",\"items\":[{\"label\":\"Tea\",\"value\":\"2 g\"},{\"label\":\"Water\",\"value\":\"150–180 ml\"},{\"label\":\"Temperature\",\"value\":\"95°C, just off the boil\"},{\"label\":\"Steep\",\"value\":\"3–4 minutes\"},{\"label\":\"Re-steep\",\"value\":\"Re-steep once\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_iced","type":"json","value":"{\"title\":\"Iced Orthodox Black Tea\",\"description\":\"Suggested adaptation; the provided guidance is for the hot brew.\",\"items\":[{\"label\":\"Tea\",\"value\":\"2 g\"},{\"label\":\"Water\",\"value\":\"150 ml at 95°C\"},{\"label\":\"Steep\",\"value\":\"4 minutes\"},{\"label\":\"Method\",\"value\":\"Strain over ice and adjust dilution to taste\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"recipe_latte","type":"json","value":"{\"title\":\"Orthodox Black Tea with Milk\",\"description\":\"Optional serving suggestion; the tea is described as needing no milk.\",\"items\":[{\"label\":\"Tea\",\"value\":\"2 g\"},{\"label\":\"Water\",\"value\":\"150 ml at 95°C\"},{\"label\":\"Steep\",\"value\":\"3–4 minutes, then strain\"},{\"label\":\"Milk\",\"value\":\"Add a splash if desired\"},{\"label\":\"Sweetener\",\"value\":\"Optional, to taste\"}]}"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"process","type":"single_line_text_field","value":"Orthodox whole-leaf"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"tea_style","type":"single_line_text_field","value":"Orthodox black tea"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_yes","type":"list.single_line_text_field","value":"[\"You enjoy mellow black tea with malt and light honey notes\",\"You prefer whole-leaf orthodox tea over CTC or dust\",\"You want a morning cup with medium-high caffeine\",\"You like tea that can be re-steeped once\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"is_this_tea_no","type":"list.single_line_text_field","value":"[\"You prefer green, floral or strongly vegetal tea\",\"You are looking for a low-caffeine tea\",\"You want a tea specifically intended for a strong milk chai\"]"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_tea","type":"multi_line_text_field","value":"This reserve stood out for its orthodox whole leaf, bright orange liquor and sweet, mellow character. Its malt and light honey notes make it a satisfying morning cup, while the whole leaves can be re-steeped once."},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"why_choose_attribution","type":"single_line_text_field","value":"Kamalika · Founder, Charaideo Reserves"}
  ],
  "teaRecord": [
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"origin","type":"single_line_text_field","value":"Upper Assam, India"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"grade","type":"single_line_text_field","value":"TGFOP1 — Top Grade Flowery Orange Pekoe One"},
    {"ownerId":"{{product_gid}}","namespace":"custom","key":"net_weight","type":"weight","value":"{\"value\":50,\"unit\":\"GRAMS\"}"}
  ]
}
```

## Validation checklist

After sending request 03, validate:

- `editorial.userErrors` is empty.
- `teaRecord.userErrors` is empty.
- The returned metafield values are present on the product record in Shopify Admin.
- The product page renders the values without nulls or type mismatches.
- JSON recipe fields parse correctly in the storefront.

## Notes on interpretation

These values are best treated as curated tasting metadata rather than laboratory results. The score fields are designed as a 1–5 editorial rating, not a scientifically standardized sensory panel. Where the source page did not provide a value, leave it blank or use a clearly marked placeholder rather than inventing a fact.

Use singular values for product-level metadata and variant-level values only when the selected size genuinely changes the product experience.

## Related files

- [product-page-metafields.md](./product-page-metafields.md)
- [Charaideo_Product_Metafields.postman_collection.json](./Charaideo_Product_Metafields.postman_collection.json)
