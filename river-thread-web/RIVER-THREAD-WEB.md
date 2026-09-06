# River Thread web system

This system expands the selected Assamese **চ** mark with its River Mist stroke
and tea-liquor seed. The symbol remains the recognizable signature, while each
page receives a different composition and purpose.

## Page variations

| Page | Variation A | Variation B |
|---|---|---|
| About Us | `about-source` - poetic origin story | `about-heritage` - chapter-led heritage statement |
| Products | `products-garden-flow` - garden contours | `products-index` - structured collection navigation |
| Cart | `cart-basket` - river becomes a basket handle | `cart-selection` - item count becomes the visual anchor |
| Contact Us | `contact-confluence` - two lines meet | `contact-open-current` - conversational mark-led heading |

| Page | Variation C | Variation D |
|---|---|---|
| About Us | `about-timeline` - heritage timeline | `about-map-route` - abstract source map |
| Products | `products-tasting-scale` - flavor discovery | `products-shelves` - tea library |
| Cart | `cart-journey` - fulfillment journey | `cart-empty` - quiet empty-cart invitation |
| Contact Us | `contact-routes` - branching enquiries | `contact-hospitality` - open-table welcome |

Two responsive header lockups and three product-card badges are also supplied.

## Typography

Use **Cormorant Garamond** 500 for display and story-led headings. Use
**Manrope** 400/600 for navigation, product information, prices, buttons, form
labels, and body copy. Baskerville and Helvetica Neue remain the local fallback
references used to draw the outlined SVG assets.

The package includes five typography boards:

- `typography-specimen` - overall hierarchy
- `typography-story` - About pages, provenance, journal, and pull quotes
- `typography-product` - product names, tasting notes, metadata, and pricing
- `typography-checkout` - progress, totals, and reassurance
- `typography-form` - labels, fields, and contact messaging

`river-thread.css` contains responsive live-text classes. Keep important page
titles as semantic HTML; use the SVG compositions as decorative headers or
art-direction references.

## Production notes

- Every PNG has a transparent background.
- Every SVG contains vector outlines rather than live font dependencies.
- Section graphics export at 1600 × 600 px.
- Typography boards export at 1600 × 1000 px.
- Headers export at 2400 × 480 and 1200 × 360 px.
- Product badges export at 512 × 512 px.
- Palette: Deep Assam Red `#5C171C`, Heritage Red `#B12B2D`, River Mist
  `#78908C`, Tea-Liquor Amber `#B87936`, Aged Indigo `#31484A`, Burnt Clay
  `#9D5F45`, and Gamosa Cream `#F4EBDD`.
