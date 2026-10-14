# Tea Sensory product metafield

Tea Academy reads one Shopify product metafield:

- Namespace: `custom`
- Key: `tea_sensory_profile`
- Type: `json`
- Owner: `PRODUCT`

Create the definition in Shopify Admin under **Settings → Custom data → Products → Add definition**. Name it **Tea sensory profile**, select **JSON**, and enable Storefront API access. The storefront ignores missing, disabled, malformed, or incomplete profiles.

## Starter value

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "flavours": ["malty", "floral", "brisk"],
  "moods": ["comfort", "energised"],
  "intensities": ["balanced", "bold"],
  "styles": ["hot", "iced"],
  "tastingSummary": "Floral aroma with a rich malty body.",
  "origin": "Assam, India",
  "estate": "Estate name",
  "brew": {
    "temperatureC": 95,
    "seconds": 210,
    "ratio": "2–2.5 g / 200 ml"
  }
}
```

## Controlled vocabulary

- `flavours`: `floral`, `grassy`, `malty`, `roasted`, `brisk`
- `moods`: `fresh`, `calm`, `focused`, `comfort`, `energised`, `curious`
- `intensities`: `light`, `balanced`, `bold`
- `styles`: `hot`, `iced`, `whisked`

Values are lowercase. Additional values are preserved, but only values represented by the current quiz influence matching.

## Admin GraphQL definition

Run this once with an Admin API client authorized for product metafield definitions:

```graphql
mutation CreateTeaSensoryDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id name namespace key type { name } }
    userErrors { field message code }
  }
}
```

```json
{
  "definition": {
    "name": "Tea sensory profile",
    "namespace": "custom",
    "key": "tea_sensory_profile",
    "description": "Versioned tasting, mood, preparation, and brewing data used by Tea Academy.",
    "type": "json",
    "ownerType": "PRODUCT",
    "access": {"storefront": "PUBLIC_READ"}
  }
}
```

## Tea Journal

Create a Shopify blog named **Tea Journal** with the handle `tea-journal`. Published articles from that blog automatically appear at `/tea-academy/journal`. Shopify article authors are displayed as the contributor byline.
