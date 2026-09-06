# Charaideo Reserves: The River Thread tea room

## Complete visual direction

The storefront is a contemporary Assamese tea room: hospitable, literate, tactile, and spacious. Its signature is the River Thread-the Assamese **চ** crossed by a mist-coloured current and finished with a tea-liquor seed. It behaves as a mark of place, a page composition, and a thread between screens; it is never repeated as ethnic wallpaper.

The central thought is **“Tea remembers where it comes from.”** Oversized, literary headlines are paired with precise map coordinates, harvest indexes, grade information, prices, and direct buying controls. The overall feeling is quiet rather than sparse: warm paper, fine rules, controlled typography, a trace of texture, and enough room for tea photography to matter.

## Palette

| Name | Hex | Usage rule |
| --- | --- | --- |
| Tea-room paper | `#FBF8F1` | Primary canvas and text on deep colour; about 50–60% of a page. |
| Gamosa cream | `#F4EBDD` | Tactile panels, product wells, account and cart surfaces; about 15–20%. |
| Deep Assam red | `#5C171C` | Display headlines, primary actions, and the Assamese mark; about 8%. |
| Heritage red | `#B12B2D` | Focus, active states, and tiny cultural signals; never a full-page field. |
| River mist | `#78908C` | River Thread, hero fields, diagrams, and emotional emphasis. |
| Aged indigo | `#31484A` | Footer, heritage fields, and supporting type; the cool counterweight to red. |
| Tea-liquor amber | `#B87936` | Seeds, coordinates, numbering, and fine rules; use like a glint in the cup. |
| Burnt clay | `#9D5F45` | Eyebrows and editorial metadata; not for essential small text on cream. |
| Tea-leaf ink | `#202B29` | Primary commerce and body text. |
| Quiet ink | `#5F6661` | Secondary copy. |

Never distribute these colours evenly. Avoid gradients, gold flourishes, stock luxury tropes, pseudo-script, and busy cultural patterns. A very low-opacity paper grain supplies tactility. River curves and the **চ** mark get one deliberate appearance per major viewport.

## Typography, spacing, layout, and components

Display and story typography uses Cormorant Garamond 500/italic; commerce uses Manrope 400/500/600. Both load with `display=swap` and local fallbacks. Self-host subset WOFF2 files before launch if the brand requires zero third-party font requests. Calligraphic feeling is reserved for short emotional fragments; navigation, price, forms, variants, and checkout remain in Manrope.

Hero type scales from 54–108px, section headings from 40–72px, card titles from 24–31px, and body copy from 12–14px with 1.65–1.85 line height. Small uppercase labels are short geographic and editorial cues. A 4px spacing base yields 8, 12, 16, 24, 32, 48, 64, 80, and 100px rhythms. Gutters scale from 20px to 80px, and commerce containers cap near 1440px.

Buttons are square, 44–50px tall, deep red, and switch to aged indigo on hover. Cards are flat, with fine borders and no floating rounded blobs. Product grids run four columns on wide screens, two on tablet, and one on mobile. Keyboard focus uses a two-pixel Heritage Red outline with a five-pixel offset. Motion is subtle and disabled under `prefers-reduced-motion`.

## Page redesign

| Surface | Composition and commerce purpose |
| --- | --- |
| Home `/` | Stock-free River Thread hero with Assamese mark, abstract tea vessel, coordinate, shoppable tea cabinet, Ahom/Charaideo memory field, and three-part ritual. |
| Catalog `/collections/all` | “Gardens in motion” vector composition, reserve index, paginated products, type/grade, notes, price, and quick add. |
| Product `/products/:handle` | Mist-framed selected-variant image, Assam coordinate, price, variants, add-to-cart, merchant story, tasting notes, brewing guidance, and delivery/care. |
| Cart `/cart` and drawer | River-basket composition, editable optimistic lines, discounts and gift cards, order summary, hosted-checkout handoff, and quiet empty state. |
| Checkout entry | Uses the Shopify cart `checkoutUrl`; shipping and tax expectations appear beside the CTA. Hosted checkout branding is configured in Shopify. |
| Contact `/pages/contact` | Deep-indigo hospitality composition, direct email and telephone links, address, hours, and a route back to shopping. |
| Sign in `/sign-in` | A dark tea-room invitation balanced by one calm account panel and the existing Customer Account login handoff. |
| About `/pages/about-us` | “Where the river remembers” composition followed by cultural memory, mission, vision, and founder chapters. |

## Production-ready Hydrogen structure

```text
root.tsx → PageLayout
  Header → River Thread Brand + navigation + Account/Search/optimistic CartBadge
  Aside.Provider → accessible cart, search, and mobile-menu dialogs
  routes/_index.tsx → deferred tea cabinet → ProductItem
  routes/collections.all.tsx → pagination → CatalogProductCard
  routes/products.$handle.tsx → ProductImage + ProductForm
    ProductForm → mapped variant options + AddToCartButton → CartForm
  routes/cart.tsx → CartMain → optimistic CartLineItem + CartSummary
  routes/pages.$handle.tsx → static About/Contact + Shopify-page fallback
  routes/sign-in.tsx → Customer Account login handoff
  Footer → brand, catalog links, policies, direct contact
```

The visual layer lives in `app/styles/identity.css`, loaded after legacy utilities. The River Thread CSS and vector assets are imported through Vite so production builds fingerprint them. Shopify functionality remains server-backed: `CartForm` handles add/update/remove/discount/gift-card actions, selected variants stay URL-addressable, `checkoutUrl` owns the checkout handoff, and Customer Account API owns authentication.

Product content contract:

- `productType`: public tea type or grade shown on cards and PDP.
- `custom.tasting_notes`: short, merchant-approved notes; expose the definition with Storefront `PUBLIC_READ` access.
- `custom.brewing_suggestion`: concise brewing guidance; expose with Storefront `PUBLIC_READ` access.
- Product descriptions, images, prices, variants, inventory, and availability remain merchant-owned Shopify data. Do not infer estate, harvest, organic status, flavour, or brewing temperature from a title.

Use Hydrogen `Image` with explicit aspect ratios and responsive `sizes` to prevent layout shift. Cache shared navigation and stable collection content appropriately; never cache customer, account, or cart responses publicly. Keep non-critical recommendations deferred, preserve optimistic cart feedback, and return recoverable API errors beside the initiating control.

## Verification and release gate

`npm run typecheck`, `npm run build`, and the 11 current domain tests pass. The production build fingerprints the imported River Thread SVGs. Local visual QA is still required at 375px, 768px, and 1440px because the installed Node 24 runtime could not start Miniflare in this workspace. Before release, verify keyboard-only drawers, real product imagery, sold-out and multi-variant products, add/update/remove, discount failures, account OAuth return, Shopify checkout handoff, and one test order. The storefront has not been deployed.
