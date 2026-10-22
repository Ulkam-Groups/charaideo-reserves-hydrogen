# Charaideo Reserves UI Component Inventory

Status: **Pre-revamp baseline**  
Version: **1.0**  
Date: **22 October 2026**  
Design contract: [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)

## 1. Purpose

This inventory maps the existing customer-facing Hydrogen interface to the finalized design system before implementation begins. It is the control document for the staged revamp: each surface is assigned a disposition, risk level, and migration phase so presentation can change without altering Shopify or checkout behavior.

This is a code inventory, not a screenshot audit. Visual acceptance remains required during each implementation phase.

## 2. Non-negotiable boundaries

The revamp may change markup structure, layout, typography, visual hierarchy, responsive behavior, accessible labeling, and nonessential motion. It must preserve:

- Shopify product, collection, variant, inventory, pricing, discount, gift-card, metafield, and customer-account data;
- existing Storefront API queries unless a UI requirement needs an already-authorized presentation field;
- cart create/add/update/remove behavior and cart-cookie synchronization;
- selected-variant and quantity behavior;
- Fastrr and Razorpay provider selection, payloads, launch guards, reconciliation, and error handling;
- waitlist, wishlist, product-review, shipping-estimate, Meta measurement, and authentication contracts;
- loader/action redirects, security checks, caching, analytics, and protected-write behavior.

When presentation and business behavior share a component, the business behavior is frozen first and the visual shell is migrated around it.

## 3. Inventory summary

| Area                                 | Current count or condition | Design-system implication                              |
| ------------------------------------ | -------------------------: | ------------------------------------------------------ |
| Shared TSX component files           |                         33 | Consolidate presentation primitives before route work  |
| Customer-facing UI route modules     |        27 primary surfaces | Migrate by journey rather than file size               |
| Global/route CSS files               |                         11 | Move toward one token layer and owned component styles |
| `className` declarations in UI code  |                       ~904 | High selector and presentation coupling                |
| Small-type declarations below 12px   |                       ~136 | Must migrate to the documented minimums                |
| `!important` declarations            |                       ~237 | Indicates cascade conflicts; retire incrementally      |
| Distinct radius declarations/recipes |                       ~129 | Collapse to card, control, button, and circle rules    |
| Numeric `z-index` declarations       |                        ~89 | Replace with semantic layer tokens                     |

The counts are a baseline signal, not acceptance criteria by themselves. Generated utility CSS contributes to some totals; the migration should remove active dependence before deleting generated rules.

## 4. Disposition and risk legend

### Disposition

- **Preserve:** already close to the design contract; token and accessibility alignment only.
- **Refine:** retain component structure and behavior; revise visual hierarchy and states.
- **Restructure:** markup or interaction semantics should change while preserving behavior.
- **Consolidate:** merge duplicated visual patterns into a shared primitive.
- **Invisible:** no visual redesign; verify that integration behavior remains unaffected.
- **Retired/redirect:** no UI migration; preserve redirect or terminal behavior.

### Regression risk

- **Critical:** checkout, cart, price, variant, inventory, authentication, or order state.
- **High:** conversion path, asynchronous state, modal/drawer focus, or external service integration.
- **Medium:** navigation, discovery, filters, forms, or persisted client state.
- **Low:** editorial presentation with no commerce mutation.

### Migration phases

- **P0:** baselines, tokens, primitives, and verification harness
- **P1:** global shell and navigation
- **P2:** discovery and merchandising
- **P3:** product decision and purchase
- **P4:** cart and checkout handoff
- **P5:** account, service, editorial, and education
- **P6:** CSS consolidation and final cross-journey QA

## 5. Shared component inventory

### 5.1 Global shell and infrastructure

| Component file                     | Components/responsibility                                                                 | Current disposition | Key design-system gaps                                                                                                                  | Risk     | Phase             |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------- |
| `PageLayout.tsx`                   | `PageLayout`, announcement `NoticeBoard`, `NoticeLink`, cart/search/mobile asides         | Restructure         | Announcement is undersized; unify layers, drawers, focus return, responsive spacing, one-message behavior                               | High     | P1                |
| `Header.tsx`                       | `Header`, desktop/mobile navigation, Tea Guide trigger, account, wishlist, cart and icons | Refine              | Normalize target sizes, icon family, tooltips, header layers, mobile density; rename visible search affordance to **Ask our tea guide** | High     | P1                |
| `Footer.tsx`                       | Brand, navigation columns, contact, payment reassurance                                   | Refine              | Raise small text, align content grid, simplify hierarchy, remove duplicate visual treatments                                            | Low      | P1                |
| `Aside.tsx`                        | Shared modal/drawer shell                                                                 | Restructure         | Semantic layer tokens, dialog labeling, focus containment/return, safe areas, escape and backdrop behavior                              | High     | P0/P1             |
| `Brand.tsx`                        | Brand lockup and `TextileRule`                                                            | Preserve            | Tokenize colour/spacing; ensure light/default variants work on approved surfaces                                                        | Low      | P1                |
| `PaymentLogos.tsx`                 | Payment-method reassurance                                                                | Preserve            | Standard icon sizing, accessible names, avoid visual clutter; methods remain provider-driven                                            | Medium   | P0/P4             |
| `RazorpayBrand.tsx`                | Razorpay trust mark                                                                       | Preserve            | Align size and contrast without altering required provider branding                                                                     | High     | P4                |
| `CheckoutConfirmationProgress.tsx` | Blocking post-payment verification state                                                  | Refine              | Modal geometry, progress semantics, readable status copy, focus behavior, no premature success language                                 | Critical | P4                |
| `MockShopNotice.tsx`               | Non-production/mock-store notice                                                          | Preserve            | Apply status banner primitive and minimum text size                                                                                     | Medium   | P0                |
| `PaginatedResourceSection.tsx`     | Shared paginated-resource wrapper                                                         | Preserve            | Normalize compact pagination controls, WCAG-compliant spacing and state announcements                                                   | Medium   | P0/P5             |
| `MetaPixel.tsx`                    | Meta measurement integration                                                              | Invisible           | No visual work; ensure UI refactors do not change event meaning or consent behavior                                                     | Critical | Verification only |

### 5.2 Product discovery and reusable merchandising

| Component file                | Components/responsibility                                                  | Current disposition | Key design-system gaps                                                                                                           | Risk   | Phase             |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------- |
| `ProductItem.tsx`             | Reusable catalog/recommendation card, variant choice and add-to-cart       | Restructure         | Adopt canonical card anatomy; replace character truncation with line clamp; 14px metadata; independent links/buttons; one radius | High   | P2                |
| `WishlistButton.tsx`          | Save/remove product control                                                | Refine              | Standard 36–38px icon button, visible selected state, consistent placement and WCAG-compliant spacing                            | Medium | P0/P2             |
| `WishlistProvider.tsx`        | Local/authenticated wishlist state and synchronization                     | Invisible           | Preserve storage, authentication and network behavior; verify state survives component migration                                 | High   | Verification only |
| `SearchForm.tsx`              | Standard search form behavior                                              | Refine              | Persistent label, 42–44px field, unified search primitive, loading/error states                                                  | Medium | P2                |
| `SearchFormPredictive.tsx`    | Predictive search request/form shell                                       | Refine              | Match standard field and panel primitives; preserve endpoint and request behavior                                                | High   | P2                |
| `SearchResults.tsx`           | Full search result groups and empty state                                  | Restructure         | Shared result card anatomy, readable metadata, useful recovery action, stable loading geometry                                   | Medium | P2                |
| `SearchResultsPredictive.tsx` | Predictive products, collections, articles, pages, queries and empty state | Restructure         | Consistent rows, keyboard navigation, semantic grouping, panel max-height and mobile behavior                                    | High   | P2                |
| `ProductExperience.tsx`       | Product section navigation and trust icons                                 | Consolidate         | Fold navigation into a shared sticky-section pattern; replace bespoke icons with approved icon family                            | Medium | P3                |

### 5.3 Product-detail and purchase components

| Component file                 | Components/responsibility                                                              | Current disposition           | Key design-system gaps                                                                                                                      | Risk     | Phase |
| ------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| `ProductImage.tsx`             | Product gallery, thumbnails and media selection                                        | Refine                        | Stable ratios, accessible gallery controls, target sizes, predictable mobile swipe, no layout shift                                         | High     | P3    |
| `ProductPrice.tsx`             | Selected/product price and comparison display                                          | Preserve                      | Tokenize typography; keep Shopify money/currency authoritative and visually connected to variant                                            | Critical | P3    |
| `ProductForm.tsx`              | Variant options, quantity, stock, add-to-cart, buy-now, notify-me, delivery and offers | Restructure presentation only | Highest density of mixed states; normalize controls, grouping, sticky mobile purchase bar, errors and reassurance without altering handlers | Critical | P3    |
| `AddToCartButton.tsx`          | Cart-line submission and analytics-aware add action                                    | Refine shell only             | Canonical primary/loading/disabled button; preserve fetcher submission, analytics and selected variant payload                              | Critical | P0/P3 |
| `DeliveryEstimate.tsx`         | Postal-code shipping estimate                                                          | Refine                        | Standard form, persistent label, inline pending/error/success, locale-appropriate input behavior                                            | High     | P3    |
| `DiscountProgress.tsx`         | Shopify-backed milestones and celebration banner                                       | Refine                        | Calm progress treatment, semantic progress/state announcements, reduced motion; never hard-code thresholds                                  | High     | P3/P4 |
| `ProductEditorialSections.tsx` | Tea story, recipe, video, record, fit and rationale sections                           | Restructure                   | Reduce bespoke shapes, normalize section rhythm, real media, manual video intent, body-size compliance                                      | Medium   | P3    |
| `AsyncProductReviews.tsx`      | Deferred Judge.me reviews and skeleton                                                 | Refine                        | Stable reserved height, non-distracting skeleton, partial-failure messaging                                                                 | High     | P3    |
| `ProductReviews.tsx`           | Review summary/cards/stars                                                             | Refine                        | Accessible star names, 14–16px text, consistent cards; empty state belongs lower on PDP                                                     | Medium   | P3    |

### 5.4 Cart and checkout components

| Component file     | Components/responsibility                                                     | Current disposition           | Key design-system gaps                                                                                              | Risk     | Phase |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| `CartMain.tsx`     | Page/drawer cart, empty state, recommendations, recent product and trust list | Restructure presentation only | Shared page/drawer anatomy, remove emoji trust icons, stabilize async recommendations, calm upsell density          | Critical | P4    |
| `CartLineItem.tsx` | Cart product row, quantity update and removal                                 | Refine shell only             | Compact WCAG-compliant quantity controls, clearer variant/price hierarchy, pending overlay and error recovery       | Critical | P4    |
| `CartSummary.tsx`  | Totals, savings, shipping, checkout, secure payments, discount and gift cards | Restructure presentation only | One primary checkout action, canonical forms, readable totals, clear provider state; preserve all checkout payloads | Critical | P4    |

### 5.5 Editorial, education and utility components

| Component file             | Components/responsibility                                               | Current disposition | Key design-system gaps                                                                                     | Risk   | Phase |
| -------------------------- | ----------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- | ------ | ----- |
| `AboutStoryExtras.tsx`     | Journey map and newsletter signup                                       | Refine              | Replace decorative one-offs with editorial rhythm; normalize newsletter form and consent/error states      | Medium | P5    |
| `TeaSensoryExperience.tsx` | Guided sensory questions, result ranking, brew guide and pending result | Restructure         | Shared choice controls, progress, results hierarchy, mobile sticky action, keyboard and live-region review | High   | P5    |

## 6. Route-local component inventory

### 6.1 Homepage

File: `app/routes/_index.tsx`

| Local component                       | Responsibility                                            | Disposition                                  | Risk   | Phase |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------------- | ------ | ----- |
| `Homepage`                            | Full landing journey                                      | Restructure composition                      | High   | P2    |
| `HeroBrandArtwork`                    | Signature river/tea brand animation                       | Refine and preserve signature                | Medium | P2    |
| `ChapterCollectionCard`               | Current/upcoming chapter merchandising and waitlist entry | Restructure semantics                        | High   | P2    |
| `ChapterMediaCarousel`                | Chapter images/video and dots                             | Restructure to manual-first                  | Medium | P2    |
| `ChapterWaitlistArtwork`              | Locked chapter/product presentation                       | Refine                                       | Low    | P2    |
| `ChapterProductArtwork`               | Product collage treatment                                 | Refine                                       | Low    | P2    |
| `ChapterComingSoonArtwork`            | Empty/upcoming release presentation                       | Refine                                       | Low    | P2    |
| `HomepageProductCard`                 | Homepage commerce card                                    | Consolidate with shared product-card anatomy | High   | P2    |
| `HomepageProductRail`                 | Product rail and section heading                          | Refine                                       | Medium | P2    |
| Waitlist modal/form inside `Homepage` | Chapter notification capture                              | Restructure shell only                       | High   | P2    |

Required direction:

- **Explore the current chapter** remains the dominant hero action.
- **Our story →** becomes tertiary.
- The current/open chapter is the first clear destination.
- Card containers stop pretending to be links/buttons; media, title and CTA receive independent native controls.
- Preserve inventory refresh, waitlist submission, Shopify collection/product selection, and query-string behavior.

### 6.2 Reserve List

File: `app/routes/reserve-list.tsx`

| Local component         | Responsibility                                     | Disposition                            | Risk     | Phase |
| ----------------------- | -------------------------------------------------- | -------------------------------------- | -------- | ----- |
| `ReserveList`           | Tabs, search, filters, sort and result composition | Restructure                            | High     | P2    |
| `ReserveChapterSection` | Chapter group and state summary                    | Refine                                 | Medium   | P2    |
| `ReserveTeaCard`        | Available/locked product presentation              | Consolidate toward shared card anatomy | High     | P2    |
| `ReserveBuyNowButton`   | Direct checkout-provider launch                    | Refine shell only                      | Critical | P2/P3 |

Required direction:

- Intro copy: **Discover limited estate releases by Chapter, or browse teas by Collection.**
- Keep Chapter and Collection as clear tabs with predictable keyboard behavior.
- Filters and sort share common control/sheet patterns and preserve URL state.
- No checkout-provider logic, product eligibility, filter semantics, or Shopify data mapping changes.

### 6.3 Product details

File: `app/routes/products.$handle.tsx`

| Local component     | Responsibility                             | Disposition                  | Risk     | Phase |
| ------------------- | ------------------------------------------ | ---------------------------- | -------- | ----- |
| `Product`           | PDP composition and selected-variant state | Restructure composition only | Critical | P3    |
| `TeaSpecifications` | Shopify-backed facts/specifications        | Refine                       | Medium   | P3    |

Required direction:

- Above the fold prioritizes origin, title, tasting cue, selected price/pack, availability and purchase.
- Empty review prominence is replaced with `New release · {Estate name}` and documented fallbacks; review invitation stays in the review section.
- Editorial detail follows the purchase decision instead of interrupting it.
- Preserve deferred recommendations/reviews, variant synchronization, analytics and product-origin rules.

### 6.4 Collection routes

| Route/local component                       | Responsibility            | Disposition                 | Risk   | Phase    |
| ------------------------------------------- | ------------------------- | --------------------------- | ------ | -------- |
| `collections._index.tsx` / `Collections`    | Collection directory      | Refine                      | Medium | P2       |
| `collections._index.tsx` / `CollectionItem` | Collection card           | Consolidate with card rules | Medium | P2       |
| `collections.$handle.tsx` / `Collection`    | Single collection listing | Refine                      | High   | P2       |
| `collections.all.tsx` / `Collection`        | All-products catalog      | Refine                      | High   | P2       |
| `collections.$.tsx`                         | Collection catch-all      | Retired/redirect behavior   | Low    | Preserve |

### 6.5 Search and wishlist

| Route          | Responsibility                  | Disposition                         | Risk   | Phase |
| -------------- | ------------------------------- | ----------------------------------- | ------ | ----- |
| `search.tsx`   | Full search page and pagination | Restructure composition             | High   | P2    |
| `wishlist.tsx` | Saved-tea collection            | Refine and use shared product cards | Medium | P2    |

### 6.6 Cart and payment result

| Route                           | Responsibility                                     | Disposition                       | Risk     | Phase             |
| ------------------------------- | -------------------------------------------------- | --------------------------------- | -------- | ----------------- |
| `cart.tsx`                      | Cart page loader/action shell and `CartMain` mount | Preserve logic; refine page frame | Critical | P4                |
| `cart.$lines.tsx`               | Cart permalink/line handling                       | Invisible                         | Critical | Verification only |
| `checkout.razorpay.success.tsx` | Payment return and confirmation UI                 | Refine state presentation         | Critical | P4                |

### 6.7 Account

| Route/local component                                                                                       | Responsibility                                    | Disposition                   | Risk     | Phase             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- | -------- | ----------------- |
| `account.tsx` / `AccountLayout`, `AccountMenu`, `Logout`                                                    | Account shell and navigation                      | Restructure shell only        | High     | P5                |
| `account.profile.tsx` / `AccountProfile`                                                                    | Profile form                                      | Refine                        | High     | P5                |
| `account.addresses.tsx` / `Addresses`, `NewAddressForm`, `ExistingAddresses`, `AddressForm`, `AddressInput` | Address CRUD                                      | Restructure presentation only | Critical | P5                |
| `account.orders._index.tsx` / `Orders`, `OrdersTable`, `EmptyOrders`, `OrderSearchForm`, `OrderItem`        | Order search/list/empty state                     | Restructure presentation only | High     | P5                |
| `account.orders.$id.tsx` / `OrderRoute`, `OrderLineRow`                                                     | Order detail                                      | Refine                        | High     | P5                |
| `sign-in.tsx` / `SignIn`                                                                                    | Customer-account entry                            | Refine                        | High     | P5                |
| `account._index.tsx`                                                                                        | Redirect to orders                                | Retired/redirect behavior     | Medium   | Preserve          |
| `account_.login.tsx`, `account_.authorize.tsx`, `account_.logout.tsx`, `account.$.tsx`                      | Shopify Customer Account authentication/redirects | Invisible                     | Critical | Verification only |

### 6.8 Content, contact and policy pages

| Route/local component                                                    | Responsibility         | Disposition                   | Risk   | Phase |
| ------------------------------------------------------------------------ | ---------------------- | ----------------------------- | ------ | ----- |
| `pages.$handle.tsx` / `Page`, `StaticPage`                               | Shopify page rendering | Refine shared editorial frame | Medium | P5    |
| `pages.$handle.tsx` / `ContactPage`, `ContactForm`, `ContactChannelIcon` | Contact experience     | Restructure presentation only | High   | P5    |
| `pages.$handle.tsx` / `AboutStoryPage`                                   | Brand story            | Refine editorial composition  | Low    | P5    |
| `policies._index.tsx` / `Policies`                                       | Policy index           | Refine                        | Low    | P5    |
| `policies.$handle.tsx` / `Policy`                                        | Shopify policy content | Refine reading layout         | Medium | P5    |
| `$.tsx` / `CatchAllPage`                                                 | Not-found surface      | Refine empty/error pattern    | Low    | P5    |

Shopify-supplied rich text must remain intact, sanitized as currently implemented, and legible at the narrow reading width.

### 6.9 Tea Academy

| Route/local component                                          | Responsibility             | Disposition  | Risk   | Phase |
| -------------------------------------------------------------- | -------------------------- | ------------ | ------ | ----- |
| `tea-academy._index.tsx` / `TeaAcademy`, `AcademyJournal`      | Academy tabs and overview  | Restructure  | Medium | P5    |
| `tea-academy.sensory.tsx` / `TeaSensoryPage`                   | Dedicated sensory tool     | Refine frame | Medium | P5    |
| `tea-academy.journal._index.tsx` / `TeaJournal`                | Journal index              | Refine       | Low    | P5    |
| `tea-academy.journal.$articleHandle.tsx` / `TeaJournalArticle` | Article reading experience | Refine       | Low    | P5    |

### 6.10 Redirected or non-UI route modules

The following are outside the visual inventory but inside regression verification:

- `blends.tsx` / `Blends`
- `collections.$.tsx` / `CollectionsCatchAll`
- `cart.$lines.tsx` / `Component`
- `discount.$code.tsx`
- account authentication/redirect modules
- API routes for wishlist, waitlist, contact, reviews, shipping estimate, cart state/recommendations and checkout
- webhook, health, sitemap, robots, favicon and agent endpoints

Their behavior must not change as a side effect of shared layout, form, or route refactoring.

## 7. Stylesheet ownership inventory

| Stylesheet                      | Current role                                  | Target treatment                                                     |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `styles/reset.css`              | Legacy global element defaults                | Replace conflicts with one intentional reset/base layer              |
| `styles/app.css`                | Broad application and legacy component styles | Split shared base from component ownership incrementally             |
| `styles/design-system.css`      | Canonical tokens and opt-in primitives        | Permanent foundation and source of truth                             |
| `styles/identity.css`           | Brand tokens plus broad overrides             | Seed canonical tokens, then retire aliases and route overrides       |
| `styles/revamp.css`             | Large cross-application override layer        | Migrate consumers and shrink; do not add new rules here by default   |
| `styles/shell.css`              | Design-system-owned global shell              | Own announcement, header, navigation, drawers and footer             |
| `assets/homepage-artifact.css`  | Generated homepage utilities and local fixes  | Freeze, remove active dependency component by component, then retire |
| `assets/reserve-list.css`       | Reserve List page system                      | Migrate to tokens and shared card/control primitives                 |
| `styles/product-experience.css` | PDP editorial/purchase experience             | Keep route ownership but replace raw values with tokens              |
| `styles/cart-page.css`          | Cart page/drawer presentation                 | Keep route ownership; align with shared cart primitives              |
| `styles/tea-academy.css`        | Academy and sensory experience                | Keep route ownership; align controls/type/grid                       |
| `styles/brand-story.css`        | Homepage/about storytelling                   | Preserve editorial character; remove conflicting global rules        |
| `styles/about-story-page.css`   | About-page-specific composition               | Consolidate with brand-story styles where patterns genuinely match   |

### Target cascade

The eventual stylesheet order should express ownership clearly:

1. Reset/base
2. Design tokens
3. Shared primitives
4. Shared composed components
5. Route-owned layout
6. Explicit third-party adaptations

New revamp work must not be implemented as another global override stylesheet.

## 8. Primitive set required before route migration

P0 should establish these CSS/React contracts without changing business behavior:

1. `Container` and section spacing
2. Display/page/section/card typography classes
3. Primary, secondary, tertiary and icon button styles
4. Text field, select, textarea, checkbox/radio, option chip and quantity stepper
5. Status banner, inline message and toast
6. Modal, drawer and popover layer/focus behavior
7. Product card, chapter card and editorial card shells
8. Price, metadata, status badge and provenance label
9. Skeleton and async-content reservation
10. Empty/error state
11. Responsive image frame
12. Approved icon wrapper

Primitives should accept native element semantics and existing handlers rather than owning Shopify data.

## 9. Business-logic freeze map

| Frozen behavior                            | Primary implementation locations                                | Required regression evidence                                         |
| ------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Product selection and variant availability | `ProductForm`, PDP route, variant utilities                     | Selected price/image/availability and URL stay synchronized          |
| Add to cart                                | `AddToCartButton`, `ProductForm`, `ProductItem`, Reserve cards  | Correct merchandise ID and quantity; drawer/page cart updates        |
| Buy now / provider launch                  | `ProductForm`, `ReserveBuyNowButton`, checkout provider library | Existing Fastrr/Razorpay payload and failure handling unchanged      |
| Cart updates and persistence               | `CartMain`, `CartLineItem`, cart routes/hooks                   | Quantity/remove/persistence and optimistic state reconcile correctly |
| Discounts, gift cards and totals           | `CartSummary`, `DiscountProgress`, Shopify discount utilities   | Shopify totals remain authoritative; invalid states remain blocked   |
| Shipping estimate                          | `DeliveryEstimate`, shipping API route                          | Same request/response semantics with clearer presentation            |
| Waitlist                                   | Homepage modal and waitlist route                               | Same guard, submission and success/error behavior                    |
| Wishlist                                   | Provider/button/API route                                       | Guest and authenticated persistence remain correct                   |
| Reviews                                    | Deferred loader, Judge.me integration and review components     | Provider failure does not block PDP; verified data unchanged         |
| Customer account                           | Account routes and Customer Account API                         | Login, profile, address and order flows retain protected writes      |
| Analytics                                  | root, add/cart/checkout components, Meta module                 | Event timing and payload meaning remain unchanged                    |

## 10. Existing verification and missing coverage

The repository already contains unit, integration and E2E coverage for cart synchronization, checkout providers, discounts, shipping, deferred data, reviews, waitlist, account authentication, security and the main catalog-to-product-to-cart flow.

The UI revamp also needs explicit visual/interaction coverage for:

- header and mobile navigation keyboard/focus behavior;
- announcement rotation and reduced motion;
- predictive search keyboard navigation;
- Reserve List tabs, filters, sort and URL persistence;
- product gallery and variant focus/state behavior;
- add-to-cart loading, failure and cart-drawer focus;
- quantity limits and unavailable variants;
- empty and populated cart at mobile/desktop widths;
- account forms, field errors and address edit/delete confirmation;
- 320px reflow, 200% zoom, forced colours and reduced motion;
- layout shift while images, reviews and recommendations load.

## 11. Staged revamp plan

### P0 — Foundation and safety harness

1. Add canonical design tokens while mapping legacy variables.
2. Add shared primitives without changing route composition.
3. Capture baseline screenshots and critical DOM/behavior checks.
4. Add accessibility and responsive checks for the main purchase journey.
5. Record current build, typecheck and test results before visual migration.

Exit gate: tokens/primitives exist, legacy pages remain visually functional, and business tests are unchanged.

P0 implementation status:

- Canonical tokens: implemented in `app/styles/design-system.css`.
- Legacy token bridge: implemented with value-preserving aliases; no new aliases permitted.
- Opt-in layout, typography, card, image, button, field and status primitives: implemented.
- React primitive contracts: implemented in `app/components/DesignSystem.tsx`.
- Foundation contract tests: implemented in `tests/design-system.test.ts`.
- Route migration: intentionally not started until the P0 verification gate passes.

### P1 — Global shell

Migrate announcement, header, Tea Guide entry, navigation, asides and footer.

Exit gate: desktop/mobile navigation, cart/search drawers, focus return, sticky behavior and third-party chat remain functional.

P1 implementation status:

- Announcement, header, navigation, store tools, drawers and footer now consume the canonical visual contract through `app/styles/shell.css`.
- Existing links, handlers, cart analytics, authentication state, focus trap/return and Shopify Chat launch behavior are unchanged.
- Tea assistance entry is labelled “Ask our tea guide”.
- Automated regression verification is complete; interactive visual verification remains required before P1 is closed.

### P2 — Discovery and merchandising

Migrate homepage, current Chapter, Reserve List, collection pages, search, predictive search and wishlist using shared card/control patterns.

Exit gate: users can find a tea through Chapter, Collection, search or wishlist with filters/URLs preserved.

P2 implementation status:

- Shared `ProductItem` card anatomy is migrated through `app/styles/merchandising.css`.
- Shopify-derived titles, descriptions, prices, variants and availability remain authoritative.
- Character-count truncation is replaced by a three-line visual clamp so source content is preserved in the DOM.
- Variant pills retain the existing compact commerce dimensions and remain subordinate to purchase actions, which are capped at 38px. Accessibility is supported through legibility, spacing, focus visibility and clear states rather than blanket component enlargement.
- Homepage product cards now use the same image, type, control, button, focus and motion contract while retaining their existing Shopify variant, wishlist and cart behavior.
- Reserve List migration is typography-first: existing card, grid, control and block dimensions are frozen while genuinely undersized labels are corrected.
- Collection, search and wishlist card consolidation remains staged after the Reserve List slice is verified.

### P3 — Product decision and purchase

Migrate PDP gallery, provenance, price, options, quantity, stock, primary actions, delivery, offers, reviews, editorial sections and recommendations.

Exit gate: every variant/availability state and purchase path matches baseline behavior.

P3 implementation status:

- Top purchase-section migration is in progress with its gallery, buy-box and control dimensions frozen.
- Shopify-authoritative price, variant, inventory and product content remain unchanged.
- Quantity limits, cart-line submission, Fastrr/Razorpay checkout, analytics and unavailable/notify behavior remain frozen.
- The first slice corrects only undersized decision-support text and maps the buy box to the approved interface/editorial type families.
- Purchase-state hierarchy now distinguishes available, sold-out, unavailable, discounted, neutral-status and error states without changing their Shopify-driven conditions.
- Delivery estimate, discount progress, assurances, quick facts and mobile purchase-bar typography are migrated without changing their dimensions or Shiprocket/Shopify behavior.
- Gallery image, thumbnail, arrow, counter, zoom and lightbox states are migrated without changing media ratios or component dimensions; the cursor-relative zoom focal-point defect is corrected.
- Shopify-backed provenance and product specifications retain their existing cards, grids and content while undersized labels, type families, contrast and CTA focus are normalized.
- Review loading, unavailable, empty, summary and populated-card states now use readable commerce typography and reduced-motion-safe loading treatment without changing Judge.me fetching or fallback behavior.
- Editorial tasting, brewing, fit and rationale sections now use the approved interface/editorial hierarchy while all Shopify metafield content and parsing remain authoritative.
- Related-product discovery retains the shared product-card contract and now has explicit narrow-container protection.
- P3 visual acceptance across the documented desktop/mobile widths and variant states remains the final exit-gate task.

### P4 — Cart and checkout handoff

Migrate cart drawer/page, line items, recommendations, totals, discounts, gift cards, secure payment presentation and payment confirmation.

Exit gate: Fastrr and Razorpay flows, cart persistence, discounts and reconciliation tests pass unchanged.

### P5 — Account, service and editorial

Migrate sign-in, account, addresses, orders, contact, policies, About, Tea Academy, journal, sensory tool, error and empty surfaces.

Exit gate: forms, protected writes, order data and Shopify content rendering remain correct.

P5 implementation status:

- Contact and About/brand-story migration is in progress.
- Contact submission, Turnstile, success/error responses and external contact destinations remain behavior-frozen.
- Contact validation states now have explicit valid, invalid, success and error treatments; the response-time promise is consistent across the page.
- Contact and About actions use the compact commerce button ceiling without altering their labels or destinations.
- Tea Academy, journal, sensory, policies and shared not-found/empty/error surfaces remain staged next.

### P6 — Consolidation and final QA

1. Remove only verified-unused legacy rules and aliases.
2. Eliminate remaining sub-12px UI text, unsupported radii/shadows and arbitrary layers.
3. Verify every route at the design-system viewports and states.
4. Run full typecheck, test, integration, E2E, build, accessibility and visual regression suites.
5. Compare performance and layout stability with the P0 baseline.

Exit gate: no new stylesheet override layer, no business regression, and all customer-facing surfaces are accounted for in this inventory.

## 12. Implementation order within each component

For each inventory item:

1. Identify frozen data and handlers.
2. Capture current states and responsive behavior.
3. Add or reuse the smallest shared primitive.
4. Change semantic structure before decorative styling.
5. Apply tokens; do not introduce arbitrary values.
6. Verify loading, empty, error, success, disabled, unavailable and partial-failure states.
7. Run focused tests and visual checks.
8. Remove superseded styles only after all consumers are known.
9. Update this inventory from planned to migrated with evidence.

## 13. Definition of inventory completion

This inventory is complete when:

- every shared TSX component file is listed;
- every customer-facing route surface and route-local named component is assigned a disposition;
- non-UI routes are explicitly excluded but retained in regression scope;
- every stylesheet has a target ownership strategy;
- critical Shopify and checkout behaviors have a freeze rule;
- every migration phase has an exit gate;
- implementation can begin with P0 without requiring a new visual-system decision.

## Appendix A — Symbol-level component coverage

The disposition, risk and phase assigned to a file in Sections 5 and 6 also apply to its internal components below unless a more specific route row overrides them. This appendix prevents locally declared UI from being missed during migration.

### Root UI

| File       | UI symbols                                                 |
| ---------- | ---------------------------------------------------------- |
| `root.tsx` | `App`, `FastrrWarmup`, `DeferredStylesheet`, `ShopifyChat` |

`FastrrWarmup`, `DeferredStylesheet`, and `ShopifyChat` are integration surfaces. Their presentation may be aligned where visible, but their loading and third-party behavior remain frozen.

### Shared component symbols

| File                               | UI symbols                                                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AboutStoryExtras.tsx`             | `JourneyMap`, `NewsletterSignup`                                                                                                                                                                                                        |
| `AddToCartButton.tsx`              | `AddToCartButton`, `AddToCartSubmit`                                                                                                                                                                                                    |
| `Aside.tsx`                        | `Aside`                                                                                                                                                                                                                                 |
| `AsyncProductReviews.tsx`          | `AsyncProductReviews`, `ReviewsSkeleton`                                                                                                                                                                                                |
| `Brand.tsx`                        | `Brand`, `TextileRule`                                                                                                                                                                                                                  |
| `CartLineItem.tsx`                 | `CartLineItem`, `CartLineQuantity`, `CartLineRemoveButton`, `CartLineUpdateButton`                                                                                                                                                      |
| `CartMain.tsx`                     | `CartMain`, `CartRecommendations`, `CartEmpty`, `RecentProductSuggestion`                                                                                                                                                               |
| `CartSummary.tsx`                  | `CartSummary`, `CartSavings`, `CartCheckoutActions`, `SecurePayments`, `CartDiscounts`, `UpdateDiscountForm`, `CartGiftCard`, `AddGiftCardForm`, `RemoveGiftCardForm`                                                                   |
| `CheckoutConfirmationProgress.tsx` | `CheckoutConfirmationProgress`                                                                                                                                                                                                          |
| `DeliveryEstimate.tsx`             | `DeliveryEstimate`                                                                                                                                                                                                                      |
| `DiscountProgress.tsx`             | `DiscountProgress`, `CelebrationBanner`                                                                                                                                                                                                 |
| `Footer.tsx`                       | `Footer`, `FooterColumn`                                                                                                                                                                                                                |
| `Header.tsx`                       | `Header`, `HeaderMenu`, `ChevronIcon`, `HeaderCtas`, `WishlistLink`, `AccountLink`, `HeaderMenuMobileToggle`, `SearchToggle`, `CartBadge`, `CartToggle`, `CartBanner`, `SearchIcon`, `AccountIcon`, `CartIcon`, `MenuIcon`              |
| `MetaPixel.tsx`                    | `MetaPixel`                                                                                                                                                                                                                             |
| `MockShopNotice.tsx`               | `MockShopNotice`                                                                                                                                                                                                                        |
| `PageLayout.tsx`                   | `PageLayout`, `NoticeBoard`, `NoticeLink`, `CartAside`, `SearchAside`, `MobileMenuAside`                                                                                                                                                |
| `PaginatedResourceSection.tsx`     | `PaginatedResourceSection`                                                                                                                                                                                                              |
| `PaymentLogos.tsx`                 | `PaymentLogos`                                                                                                                                                                                                                          |
| `ProductEditorialSections.tsx`     | `ProductEditorialSections`, `SectionHeading`, `CupCharacter`, `Fact`, `RecipeExperience`, `RecipeVideo`, `TeaRecord`, `TeaFit`, `FitList`, `WhyThisTea`                                                                                 |
| `ProductExperience.tsx`            | `ProductSectionNav`, `TrustIcon`                                                                                                                                                                                                        |
| `ProductForm.tsx`                  | `ProductForm`, `NotifyMeForm`, `ProductOptionSwatch`                                                                                                                                                                                    |
| `ProductImage.tsx`                 | `ProductImage`                                                                                                                                                                                                                          |
| `ProductItem.tsx`                  | `ProductItem`                                                                                                                                                                                                                           |
| `ProductPrice.tsx`                 | `ProductPrice`                                                                                                                                                                                                                          |
| `ProductReviews.tsx`               | `ProductReviews`, `ReviewCard`, `Stars`                                                                                                                                                                                                 |
| `RazorpayBrand.tsx`                | `RazorpayBrand`                                                                                                                                                                                                                         |
| `SearchForm.tsx`                   | `SearchForm`                                                                                                                                                                                                                            |
| `SearchFormPredictive.tsx`         | `SearchFormPredictive`                                                                                                                                                                                                                  |
| `SearchResults.tsx`                | `SearchResults`, `SearchResultsArticles`, `SearchResultsPages`, `SearchResultsProducts`, `SearchResultsEmpty`                                                                                                                           |
| `SearchResultsPredictive.tsx`      | `SearchResultsPredictive`, `SearchResultsPredictiveArticles`, `SearchResultsPredictiveCollections`, `SearchResultsPredictivePages`, `SearchResultsPredictiveProducts`, `SearchResultsPredictiveQueries`, `SearchResultsPredictiveEmpty` |
| `TeaSensoryExperience.tsx`         | `TeaSensoryExperience`, `SensoryResult`, `BrewGuide`, `SensoryPendingResult`                                                                                                                                                            |
| `WishlistButton.tsx`               | `WishlistButton`                                                                                                                                                                                                                        |
| `WishlistProvider.tsx`             | `WishlistProvider`                                                                                                                                                                                                                      |

### Route-local symbol coverage

| File                                     | UI symbols                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_index.tsx`                             | `Homepage`, `HeroBrandArtwork`, `ChapterCollectionCard`, `ChapterMediaCarousel`, `ChapterWaitlistArtwork`, `ChapterProductArtwork`, `ChapterComingSoonArtwork`, `HomepageProductCard`, `HomepageProductRail`, embedded waitlist modal/form |
| `reserve-list.tsx`                       | `ReserveList`, `ReserveChapterSection`, `ReserveTeaCard`, `ReserveBuyNowButton`                                                                                                                                                            |
| `products.$handle.tsx`                   | `Product`, `TeaSpecifications`                                                                                                                                                                                                             |
| `collections._index.tsx`                 | `Collections`, `CollectionItem`                                                                                                                                                                                                            |
| `collections.$handle.tsx`                | `Collection`                                                                                                                                                                                                                               |
| `collections.all.tsx`                    | `Collection`                                                                                                                                                                                                                               |
| `search.tsx`                             | `SearchPage`                                                                                                                                                                                                                               |
| `wishlist.tsx`                           | `WishlistPage`                                                                                                                                                                                                                             |
| `cart.tsx`                               | `Cart`                                                                                                                                                                                                                                     |
| `checkout.razorpay.success.tsx`          | `RazorpayCheckoutSuccess`                                                                                                                                                                                                                  |
| `account.tsx`                            | `AccountLayout`, `AccountMenu`, `Logout`                                                                                                                                                                                                   |
| `account.profile.tsx`                    | `AccountProfile`                                                                                                                                                                                                                           |
| `account.addresses.tsx`                  | `Addresses`, `NewAddressForm`, `ExistingAddresses`, `AddressForm`, `AddressInput`                                                                                                                                                          |
| `account.orders._index.tsx`              | `Orders`, `OrdersTable`, `EmptyOrders`, `OrderSearchForm`, `OrderItem`                                                                                                                                                                     |
| `account.orders.$id.tsx`                 | `OrderRoute`, `OrderLineRow`                                                                                                                                                                                                               |
| `sign-in.tsx`                            | `SignIn`                                                                                                                                                                                                                                   |
| `pages.$handle.tsx`                      | `Page`, `StaticPage`, `ContactForm`, `ContactPage`, `ContactChannelIcon`, `AboutStoryPage`                                                                                                                                                 |
| `policies._index.tsx`                    | `Policies`                                                                                                                                                                                                                                 |
| `policies.$handle.tsx`                   | `Policy`                                                                                                                                                                                                                                   |
| `tea-academy._index.tsx`                 | `TeaAcademy`, `AcademyJournal`                                                                                                                                                                                                             |
| `tea-academy.sensory.tsx`                | `TeaSensoryPage`                                                                                                                                                                                                                           |
| `tea-academy.journal._index.tsx`         | `TeaJournal`                                                                                                                                                                                                                               |
| `tea-academy.journal.$articleHandle.tsx` | `TeaJournalArticle`                                                                                                                                                                                                                        |
| `$.tsx`                                  | `CatchAllPage`                                                                                                                                                                                                                             |

Anonymous JSX fragments and render callbacks inherit the owning component's inventory entry. Server-only loaders, actions, GraphQL documents and utility functions are deliberately covered by regression boundaries rather than treated as visual components.

## Appendix B — Complete route registry

This is the exhaustive route-module registry at the P0 baseline. A visual migration may alter markup and presentation only for rows marked **UI**. Redirect, resource, API, webhook and system routes stay behavior-frozen even when a nearby UI route is migrated.

### Customer-visible UI routes

| Route module                             | Surface                            | Phase |
| ---------------------------------------- | ---------------------------------- | ----- |
| `$.tsx`                                  | Customer-facing not-found page     | P5    |
| `_index.tsx`                             | Homepage and Chapter discovery     | P2    |
| `account._index.tsx`                     | Account landing redirect/entry     | P5    |
| `account.addresses.tsx`                  | Address management                 | P5    |
| `account.orders.$id.tsx`                 | Order detail                       | P5    |
| `account.orders._index.tsx`              | Order history                      | P5    |
| `account.profile.tsx`                    | Profile management                 | P5    |
| `account.tsx`                            | Account shell                      | P5    |
| `cart.tsx`                               | Cart page and cart action endpoint | P4    |
| `checkout.razorpay.success.tsx`          | Payment confirmation               | P4    |
| `collections.$handle.tsx`                | Collection detail                  | P2    |
| `collections._index.tsx`                 | Collection index                   | P2    |
| `collections.all.tsx`                    | All-products collection            | P2    |
| `pages.$handle.tsx`                      | Static, contact and About pages    | P5    |
| `pages.tea-sensory.tsx`                  | Sensory-tool compatibility entry   | P5    |
| `policies.$handle.tsx`                   | Policy detail                      | P5    |
| `policies._index.tsx`                    | Policy index                       | P5    |
| `products.$handle.tsx`                   | Product detail and purchase        | P3    |
| `reserve-list.tsx`                       | Reserve discovery and buying       | P2    |
| `search.tsx`                             | Search results                     | P2    |
| `sign-in.tsx`                            | Customer sign-in entry             | P5    |
| `tea-academy._index.tsx`                 | Academy overview                   | P5    |
| `tea-academy.journal.$articleHandle.tsx` | Journal article                    | P5    |
| `tea-academy.journal._index.tsx`         | Journal index                      | P5    |
| `tea-academy.sensory.tsx`                | Sensory experience                 | P5    |
| `wishlist.tsx`                           | Saved teas                         | P2    |

### Redirect and compatibility routes

| Route module                                 | Frozen responsibility                            |
| -------------------------------------------- | ------------------------------------------------ |
| `$shopId.orders.$orderToken.authenticate.ts` | Shopify order authentication handoff             |
| `account.$.tsx`                              | Authenticated-account catch-all behavior         |
| `account_.authorize.tsx`                     | Customer Account API authorization               |
| `account_.login.tsx`                         | Login redirect initiation                        |
| `account_.logout.tsx`                        | Logout session behavior                          |
| `blends.tsx`                                 | Retired blend-route redirect                     |
| `cart.$lines.tsx`                            | Shopify cart permalink parsing and redirect      |
| `collections.$.tsx`                          | Collection catch-all redirect/not-found behavior |
| `discount.$code.tsx`                         | Discount application and safe redirect           |
| `pages.tea-sensory.tsx`                      | Canonical sensory-route compatibility behavior   |
| `sign-in.tsx`                                | Logged-in redirect plus sign-in presentation     |

Routes appearing in both lists have a customer-visible surface and a redirect or action responsibility; both responsibilities must be verified.

### Resource, API, webhook and system routes

| Route module                      | Frozen responsibility                              |
| --------------------------------- | -------------------------------------------------- |
| `[favicon.ico].tsx`               | Favicon response                                   |
| `[robots.txt].tsx`                | Robots policy response                             |
| `[sitemap.xml].tsx`               | Sitemap index response                             |
| `agent.buyer-claims.ts`           | Buyer-claims endpoint                              |
| `api.admin.teas.ts`               | Admin tea data endpoint                            |
| `api.blend-checkout.ts`           | Retired/guarded blend checkout contract            |
| `api.cart-recommendations.tsx`    | Cart recommendation payload                        |
| `api.cart-state.ts`               | Cart state payload                                 |
| `api.checkout.razorpay.order.ts`  | Razorpay order creation and reconciliation anchor  |
| `api.checkout.razorpay.verify.ts` | Razorpay payment verification                      |
| `api.contact.tsx`                 | Contact-form write contract                        |
| `api.product-reviews.ts`          | Judge.me review adapter                            |
| `api.shipping-estimate.ts`        | Shiprocket delivery estimate adapter               |
| `api.waitlist.tsx`                | Waitlist validation, rate limit and write contract |
| `api.wishlist.tsx`                | Guest/authenticated wishlist persistence           |
| `cart.clear[.js].ts`              | Fastrr Ajax-cart compatibility response            |
| `cart[.]json.tsx`                 | Cart JSON compatibility response                   |
| `health.ts`                       | Health response                                    |
| `products.$handle[.js].ts`        | Fastrr product JSON compatibility response         |
| `products.$handle[.json].ts`      | Product JSON response                              |
| `shopify-agent-api.$.ts`          | Shopify agent proxy                                |
| `shopify-chat-assets.$.ts`        | Shopify Chat asset proxy                           |
| `sitemap.$type.$page[.xml].tsx`   | Paginated sitemap response                         |
| `webhooks.orders-create.ts`       | Order-created processing and consented analytics   |
| `webhooks.razorpay.ts`            | Razorpay webhook verification and reconciliation   |

Registry gate: a file-system comparison must report all route filenames above and no undocumented route filenames before each phase begins.

## Appendix C — Integration freeze boundaries

| Integration or state boundary  | Presentation may change                           | Must remain unchanged                                                                                         |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shopify Storefront API         | Loading, empty, error and success presentation    | Queries, variables, pagination, localization and Shopify-authoritative product data                           |
| Shopify cart                   | Cart layout, controls and feedback                | `CartForm` actions, optimistic reconciliation, line IDs, quantities, discounts, gift cards and buyer identity |
| Customer Account API           | Form layout and account navigation                | Authentication, protected writes, address/order/profile payloads and redirects                                |
| Fastrr                         | Visible button treatment and pending feedback     | Provider selection, warm-up, payload, compatibility resources, guards and post-checkout behavior              |
| Razorpay                       | Visible button treatment and confirmation layout  | Order creation, signatures, verification, reconciliation, webhook handling and correlation IDs                |
| Shiprocket                     | Delivery-estimate presentation                    | Request contract, configuration handling and returned estimate semantics                                      |
| Judge.me                       | Review layout, skeleton and failure message       | Provider lookup, product mapping and verified review content                                                  |
| Wishlist                       | Button/card presentation                          | Guest storage, authenticated metafield persistence, merge behavior and API contract                           |
| Waitlist                       | Modal/form presentation                           | Validation, throttling, consent copy meaning and submission contract                                          |
| Shopify Chat                   | Launcher/panel visual adaptation                  | Asset proxy, loading, pre-warm, focus/close behavior and third-party runtime                                  |
| Meta and Hydrogen analytics    | Consent-safe visible notices                      | Consent gating, event names, timing, identifiers and payload meaning                                          |
| Monitoring/Sentry              | Error-state presentation                          | Failure capture, request correlation and server/client boundaries                                             |
| Shopify metafields/metaobjects | How provenance and editorial content are arranged | Namespace/key usage, fallbacks, values and content ownership                                                  |

## Appendix D — P0 verification matrix

Run and record the following before the first visual change and after every phase. A pre-existing failure must be documented; a new failure blocks migration.

| Check                         | Command or evidence                                                           | Protects                                             |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Route completeness            | Compare `app/routes` filenames with Appendix B                                | Hidden resource/redirect routes                      |
| Shared component completeness | Compare `app/components/*.tsx` with Section 5 and Appendix A                  | Reusable UI surfaces                                 |
| Stylesheet completeness       | Compare every `?url` CSS import with Section 7                                | Cascade and route-owned styles                       |
| Formatting                    | `npx prettier --check docs/DESIGN_SYSTEM.md docs/UI_COMPONENT_INVENTORY.md`   | Normative document integrity                         |
| Static types                  | `npm run typecheck`                                                           | Component and route contracts                        |
| Unit tests                    | `npm test`                                                                    | Cart, checkout, integrations and helpers             |
| Integration tests             | `npm run test:integration`                                                    | Protected actions and provider/server boundaries     |
| Lint                          | `npm run lint`                                                                | React, TypeScript and accessibility-adjacent defects |
| Production build              | `npm run build`                                                               | Route compilation, GraphQL/types and deploy shape    |
| Storefront E2E                | `npm run test:e2e`                                                            | Browse-to-buy, Razorpay and compatibility paths      |
| Account E2E                   | `npm run test:e2e:account`                                                    | Authentication and customer account paths            |
| Visual baseline               | Screenshots at 320, 390, 768, 1024 and 1440px                                 | Reflow, hierarchy and layout shift                   |
| Accessibility baseline        | Keyboard, focus, 200% zoom, reduced motion, forced colours and automated scan | WCAG-oriented usability                              |

Because `typecheck` and `build` run route type generation, capture `git status --short` before and after them and review generated-file changes rather than assuming they are harmless.
