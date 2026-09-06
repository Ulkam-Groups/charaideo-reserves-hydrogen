# Charaideo Reserves: A table in Assam

The identity is a contemporary Assamese tea room: hospitable, literate, tactile, and spacious. The signature is the tension between oversized ink-red serif lettering and cool mist-green space. Cream is the material, red is the cultural signal, and tea is the focus. Copy speaks in the language of everyday hospitality: “A little Assam. A world within your cup.”

## Palette

| Name | Hex | Role and rule |
| --- | --- | --- |
| Tea-room paper | #FAF9F5 | Default canvas; roughly 60% of a typical page. |
| Gamosa cream | #F0EADF | Catalog intro, cart summary, quiet product backgrounds; roughly 15%. |
| Ink red | #731E2B | Headlines, wordmark, primary buttons and rules; roughly 8%. Use paper text on filled buttons. |
| Gamosa vermilion | #A52C37 | Reserved accent token for small cultural details; never a large background. |
| Morning mist | #DFE5DE | Hero photograph frame, heritage panel, account panel; roughly 12%. |
| Aged bamboo | #46564C | Supporting editorial text and footer; roughly 5%, varying by page. |
| Fired clay | #B8785E | Decorative numerals only; avoid small essential text. |
| Tea-leaf ink | #292E29 | Commerce text. |
| Quiet grey | #62675E | Secondary text on paper. |
| Paper edge | #D8D9D0 | Dividers and subtle borders; never the sole focus indicator. |

Do not distribute the colours evenly. Red should be recognisable at a glance without taking over the page. No gradients, gold flourishes, decorative pseudo-script, or repeated ethnic wallpaper. The spare diamond rule is textile-inspired, not a claim to reproduce a specific traditional pattern.

## Typography, spacing, and layout

The implementation uses a zero-download serif stack (Baskerville, Palatino Linotype, Book Antiqua, Georgia) for stories and a system sans stack (Segoe UI, Arial) for commerce. This keeps first paint fast. If a consistent licensed brand font is commissioned, self-host subset WOFF2 files with `font-display: swap` and tune fallback metrics before replacing the tokens.

Hero type scales from 48–100px. Section headings use 35–56px; card titles 24px; body copy 14–15px with 1.6–1.8 line height. Small uppercase labels are brief navigational/editorial cues only. Avoid long all-caps paragraphs. Serif italics signal emotional phrases sparingly.

Use a 4px spacing base: 8, 12, 16, 24, 32, 48, 64, 80. Page gutters fluidly scale from 20px to 80px. Main commerce containers cap at 1440px. Product grids use four columns on wide screens, two on tablets, and one on phones to preserve image and buying-control clarity. Story copy stays around 45–65 characters wide. Buttons are square, at least 44–48px tall; cards use flat framing and fine rules. Reduced-motion preferences disable animation.

## Implemented pages

| Surface | Composition and commerce purpose |
| --- | --- |
| Home `/` | Large editorial headline beside a framed tea photograph, place-of-origin strip, shoppable tea cabinet, Ahom/Charaideo memory panel, three-part everyday ritual. |
| Catalog `/collections/all` | Clear introduction, paginated live Shopify products, product type, merchant notes or description, price, and quick add. |
| Product `/products/:handle` | Large variant image, selected-variant price, available options, add-to-cart, story, tasting notes, brewing guidance, delivery/care disclosures. |
| Cart `/cart` and drawer | Editable existing lines, discounts and gift cards, calm order summary, prominent checkout link, helpful empty state. |
| Checkout entry | Uses Shopify's cart `checkoutUrl`; shipping/tax expectations appear beside the CTA. Hosted checkout itself is configured separately in Shopify. |
| Contact `/pages/contact` | Warm invitation, direct email and telephone links, address and operating hours from existing content. No fake submission form. |
| Sign in `/sign-in` | A welcoming tea-room panel plus one clear secure sign-in CTA. Existing authenticated visitors redirect to `/account`. `/account/login` retains the Customer Account flow. |
| About `/pages/about-us` | Cultural-memory introduction and a measured sequence of brand story, Charaideo/Ahom inspiration, mission, vision, and founder. |

## React / Hydrogen structure

```text
root.tsx ? PageLayout
  Header ? Brand + HeaderMenu + SearchToggle + optimistic CartBadge
  Aside.Provider ? cart / search / mobile menu dialogs
  routes/_index.tsx ? deferred tea cabinet ? ProductItem
  routes/collections.all.tsx ? pagination ? CatalogProductCard
  routes/products.$handle.tsx ? ProductImage + ProductForm
    ProductForm ? selected options + AddToCartButton ? CartForm
  routes/cart.tsx ? CartMain ? CartLineItem + CartSummary
  routes/pages.$handle.tsx ? static About / Contact + Shopify pages fallback
  routes/sign-in.tsx ? existing Customer Account login
  Footer ? Brand + shopping, policy and contact links
```

`Brand.tsx`, `ProductItem.tsx`, and `AddToCartButton.tsx` are executable examples, not pseudo-code. Use the existing server cart handler, variant URL state, pagination, account routes, and Shopify Money/Image components. The pending add button is disabled while its fetcher submits and renders a recoverable error. Drawers restore focus, constrain Tab navigation, and close on Escape. The header includes a skip link to the main content.

The CSS entry in `root.tsx` loads existing `app.css` utilities first and the authoritative `identity.css` design layer second. New components use names scoped to their role (`tea-room-*`, `signin-*`, `catalog-card-*`); all palette and font decisions live in root tokens. This deliberately preserves existing blend-builder and ancillary-route styling. In a later cleanup, consolidate duplicated legacy selectors after a full visual regression pass; do not add another override layer.

## Shopify content contract

Set product type/grade in Shopify's `productType`. Populate `custom.tasting_notes` (single-line text, e.g. approved dot-separated notes) and `custom.brewing_suggestion` (multi-line text). Make definitions readable by the Storefront API. Missing notes are omitted; catalog cards fall back to the real product description. Missing brewing guidance points customers to pack instructions. Do not infer flavour, temperature, estate provenance, organic certification, or harvest dates from a product name.

Use actual catalog photography and live variant IDs, prices, currency and availability. Product descriptions remain merchant-owned HTML. The current home image is an external Unsplash tea photograph, a provisional atmosphere image without geographic attribution. Replace it with licensed brand photography from Assam before launch; capture the tea table, materials, hands, utensils and real gardens with accurate captions. Do not present generic scenery as Assam documentation.

Generate types after changing queries with `npm run codegen`. `codegen.ts` validates Storefront queries against the schema shipped with the installed Hydrogen package. Customer Account declarations are left intact. Then run `npm run typecheck` and `npm run build`.

Commerce follows the current official patterns: [CartForm](https://shopify.dev/docs/api/hydrogen/latest/components/cartform), [Customer Account login](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/hydrogen), and [cart checkout URL](https://shopify.dev/docs/api/hydrogen/latest/utilities/cart/cartcreatedefault). Framework code matches the installed React Router 7 / Hydrogen 2026 dependencies rather than copying older Remix examples.

## Release checks

Use `npm run dev` for the Hydrogen CLI environment loader. The plain Vite preview initially returned HTTP 500 because `SESSION_SECRET` was not supplied to the worker. The Hydrogen CLI correctly loaded the local environment; Home, Catalog, a real product detail page, About, Contact, Cart, Sign in and Search subsequently returned HTTP 200 with the expected page content. Keep credentials in the local environment / Oxygen environment settings, never source or logs. An existing full environment logger in `server.ts` was removed.

Before release, verify in a connected browser at 375px, 768px and 1440px: all routes; keyboard-only menus, search and cart; real tea images and copy; selected/sold-out variants; add, quantity update, remove; discount errors; account OAuth return; checkout handoff and a Shopify test order. Check hosted checkout brand settings separately. This implementation has not been deployed and a completed checkout is not claimed.

Validation: Storefront GraphQL generation passed; TypeScript passed; production build passed; 11 existing tests passed. No connected browser was available, so responsive visual QA and actual cart/account/checkout interactions remain unverified. npm reported 23 dependency audit findings (5 low, 6 moderate, 12 high); dependency remediation was not included in this UI change.
