# Charaideo Reserves Design System

Status: **Reviewed normative foundation**  
Version: **1.2**  
Last reviewed: **22 October 2026**  
Applies to: **Hydrogen storefront UI**  
Does not alter: **Shopify product data, pricing, inventory, metafields, collections, cart calculations, discounts, or checkout rules**

## 1. Purpose

This system defines how Charaideo Reserves should look, read, move, and behave across the storefront. It is designed to make the experience feel considered, culturally grounded, calm, and commercially clear without becoming ornamental or generic.

The system is intentionally small. Brand distinction must come from Assam, the estates, the tea, provenance, photography, typography, and editorial composition—not from introducing a new radius, shadow, colour, or animation for every component.

### Normative language

- **Must** is required for consistency, accessibility, or conversion safety.
- **Should** is the default and requires a documented reason to override.
- **May** is optional and context-dependent.

### Shopify boundary

The UI may change how Shopify-owned information is arranged or emphasized, but it must not:

- hard-code or replace product titles, descriptions, prices, availability, variants, metafields, collection content, discounts, or checkout data;
- infer claims that are not supported by Shopify data;
- obscure price, selected variant, availability, shipping qualification, or checkout state;
- create a second source of truth for commerce data.

## 2. Brand principles

Every design decision should reinforce at least one principle and contradict none.

### Rare

The experience should feel selected, not crowded. Use space, restraint, provenance, and a clear release hierarchy. Scarcity must be factual—never fabricated with countdowns, false urgency, or unsupported inventory claims.

### Assamese

Assam is the source, not a decorative theme. Prioritize real estate imagery, landscape, craft, origin, local language where appropriate, and verified product provenance. Avoid generic “exotic India” motifs, borrowed cultural decoration, or ornamental clichés.

### Editorial

Pages should read like a well-edited journal with a clear point of view: strong headlines, disciplined measure, purposeful imagery, and concise captions. Editorial does not mean small text, weak contrast, or excessive italics.

### Traceable

Help customers understand where a tea comes from and why it is distinctive. Estate, origin, flush, grade, pluck date, leaf, tasting notes, and preparation should be presented when Shopify supplies them. Missing data must be omitted gracefully, not replaced with invented copy.

### Calm

One primary action, one visual focal point, and one signature motion at a time. Interfaces should reassure rather than pressure. Decorative effects must never compete with product comprehension or purchase actions.

## 3. Experience principles

1. **The current Chapter leads.** “Explore the current chapter” is the primary homepage journey and core brand expression.
2. **Commerce remains obvious.** A first-time visitor should understand within five seconds that the site sells Assam tea.
3. **Story supports the decision.** Origin and craft should help a customer choose; they must not push price, pack size, availability, or purchase controls out of reach.
4. **One surface, one primary action.** A section, card, modal, or form must not contain multiple visually equal primary actions.
5. **Progressive disclosure beats density.** Show essential decision information first and reveal deeper editorial detail below or on request.
6. **Predictability is premium.** Real links, real buttons, familiar form behavior, visible focus, and stable layouts feel more refined than clever interaction shortcuts.
7. **Purchase hierarchy beats decorative scale.** Price, pack, stock and the next purchase action must scan as one compact decision unit. Controls earn emphasis through contrast, width, weight and placement rather than excessive height.
8. **Editorial content must sell the tea.** Estate, provenance and craft content should reduce uncertainty or increase desire; it must not turn product discovery into a magazine layout or delay a purchase decision.

## 4. Foundations

### 4.1 Core colour palette

These are the only approved core brand colours. Components must use semantic tokens rather than raw hex values.

| Token                     |     Value | Purpose                                                         |
| ------------------------- | --------: | --------------------------------------------------------------- |
| `--color-assam-green-900` | `#132A1F` | Primary brand, strong text, primary actions, dark surfaces      |
| `--color-assam-green-700` | `#2F4D3E` | Optional supporting green for charts or non-text accents        |
| `--color-leaf-600`        | `#5A6B62` | Secondary text on light surfaces                                |
| `--color-river-200`       | `#E7EDE0` | Borders, dividers, quiet selected states                        |
| `--color-gamosa-100`      | `#F5F1E6` | Warm section background and elevated neutral surface            |
| `--color-paper`           | `#FFFFFF` | Main background and cards                                       |
| `--color-tea-500`         | `#C4A484` | Decorative rules, large non-text accents, restrained highlights |
| `--color-tea-800`         | `#76552F` | Accessible provenance and eyebrow text on light surfaces        |
| `--color-ink`             | `#132A1F` | Primary text                                                    |

`#132A1F` currently serves several historical token names. New work must reference one canonical core token or a semantic token; it must not add aliases such as “red,” “indigo,” or “brown” for the same green value.

`--color-tea-500` must not be used for normal-sized text on white or cream. Its contrast is approximately `2.34:1` on white and `2.07:1` on cream. Use `--color-tea-800` for text; it is approximately `6.75:1` on white and `5.98:1` on cream.

### 4.2 Semantic colours

| Token                    |                        Default | Usage                                               |
| ------------------------ | -----------------------------: | --------------------------------------------------- |
| `--surface-page`         |           `var(--color-paper)` | Page background                                     |
| `--surface-subtle`       |      `var(--color-gamosa-100)` | Quiet section or inset background                   |
| `--surface-inverse`      | `var(--color-assam-green-900)` | Footer, announcement, high-emphasis panels          |
| `--text-primary`         |             `var(--color-ink)` | Headings and body text                              |
| `--text-secondary`       |        `var(--color-leaf-600)` | Supporting information                              |
| `--text-accent`          |         `var(--color-tea-800)` | Eyebrows, provenance labels, editorial text accents |
| `--text-inverse`         |           `var(--color-paper)` | Text on inverse surfaces                            |
| `--border-subtle`        |       `var(--color-river-200)` | Default borders and dividers                        |
| `--border-strong`        |       `rgba(19, 42, 31, 0.32)` | Focused grouping or selected state                  |
| `--action-primary`       | `var(--color-assam-green-900)` | Primary buttons and active controls                 |
| `--action-primary-hover` |                      `#0B1D15` | Primary hover state                                 |
| `--focus-ring`           | `var(--color-assam-green-900)` | Keyboard focus ring on light surfaces               |
| `--status-success`       |                      `#246B45` | Confirmed success and in-stock status               |
| `--status-warning`       |                      `#8A5A16` | Attention without failure                           |
| `--status-critical`      |                      `#A52A2A` | Errors and destructive actions only                 |
| `--status-info`          |                      `#315D70` | Neutral service information                         |

Status colours must include a text label or icon; colour alone must never communicate state. New colour combinations must meet WCAG 2.2 AA contrast before use. Decorative gold may be used for borders or marks only when the adjacent semantic information is still perceivable without it.

### 4.3 Typography

Use two font families only:

- **Editorial/display:** `Libre Baskerville`, Baskerville, Georgia, serif
- **Interface/body:** `Instrument Sans`, Inter, system-ui, sans-serif

`Cormorant Garamond` may remain temporarily on legacy surfaces during migration but must not be introduced into new components. Decorative Assamese/Bengali glyph treatments are artwork, not interface typography.

#### Two heading styles

1. **Display:** Libre Baskerville, weight 500, tracking `-0.025em`, line height `0.98–1.08`. Use only for the main hero or page title.
2. **Section:** Libre Baskerville, weight 500, tracking `-0.02em`, line height `1.05–1.18`. Use for section, card, modal, and product headings.

Do not create additional heading personalities through uppercase serif text, extreme tracking, or unrelated typefaces.

Heading line heights below `1.0` require a visual clipping check for every rendered glyph and language. They must not be used where accents, Assamese script, or user-controlled Shopify content can be clipped.

#### Type scale

| Role             | Mobile |                    Desktop | Line height | Notes                                |
| ---------------- | -----: | -------------------------: | ----------: | ------------------------------------ |
| Display          | `40px` |   `clamp(56px, 6vw, 88px)` | `0.98–1.05` | One per page maximum                 |
| Page title       | `36px` |   `clamp(48px, 5vw, 72px)` | `1.02–1.10` | H1                                   |
| Section title    | `30px` | `clamp(36px, 3.5vw, 52px)` | `1.05–1.14` | H2                                   |
| Card/title large | `22px` |                  `24–28px` | `1.12–1.25` | Product and chapter names            |
| Body large       | `18px` |                     `18px` |  `1.55–1.7` | Hero or editorial introduction       |
| Body             | `16px` |                     `16px` |  `1.55–1.7` | Default reading text                 |
| Product metadata | `14px` |                     `14px` |  `1.4–1.55` | Origin, pack, stock, notes           |
| Secondary label  | `12px` |                     `12px` |  `1.3–1.45` | Uppercase labels and eyebrows        |
| Button           | `14px` |                     `14px` |       `1.2` | Weight 600; avoid excessive tracking |

#### Minimum readable sizes

- No user-facing text may be smaller than `12px`.
- Essential product, price, variant, stock, delivery, and form information must be at least `14px`.
- Compact card labels and pack values may use `11–13px` when contrast is strong, the information is short, and the product name, price and purchase action remain immediately legible.
- Body and decision-supporting copy must be at least `16px`.
- Placeholder text must not carry information that is absent from a persistent label.
- Uppercase labels may use at most `0.12em` letter spacing. At `12px`, prefer `0.08em`.
- Long-form text should use a measure of `45–75ch`; `60–68ch` is preferred.
- For contrast calculations, “large text” follows WCAG: at least `24px` regular or approximately `18.66px` bold. Do not assume that a heading label is large text merely because it is styled as a heading.

### 4.4 Spacing scale

Use a 4px base with a deliberately limited set:

| Token        |   Value | Typical use                                  |
| ------------ | ------: | -------------------------------------------- |
| `--space-1`  |   `4px` | Icon adjustment, compact internal separation |
| `--space-2`  |   `8px` | Label-to-value, compact control gap          |
| `--space-3`  |  `12px` | Closely related content                      |
| `--space-4`  |  `16px` | Default component gap                        |
| `--space-5`  |  `24px` | Card padding, grouped fields                 |
| `--space-6`  |  `32px` | Component separation                         |
| `--space-7`  |  `48px` | Section grouping                             |
| `--space-8`  |  `64px` | Mobile section spacing or desktop subsection |
| `--space-9`  |  `96px` | Desktop page sections                        |
| `--space-10` | `128px` | Major editorial separation on large screens  |

Use `clamp()` only for page gutters, section spacing, and large type—not for arbitrary component gaps. Values outside the scale require a documented component-specific reason.

### 4.5 Content widths and gutters

| Token                |                    Value | Purpose                          |
| -------------------- | -----------------------: | -------------------------------- |
| `--content-narrow`   |                  `720px` | Reading, policy, editorial text  |
| `--content-standard` |                 `1120px` | Forms, account, most sections    |
| `--content-wide`     |                 `1280px` | Catalog and visual merchandising |
| `--content-max`      |                 `1440px` | Rare full editorial compositions |
| `--gutter-mobile`    |                   `20px` | Viewports below 480px            |
| `--gutter-tablet`    |                   `32px` | 480–1023px                       |
| `--gutter-desktop`   | `clamp(40px, 5vw, 80px)` | 1024px and above                 |

Page content must align to a shared gutter. Full-bleed media may escape the content container, but its text and controls must return to the grid.

### 4.6 Responsive grid

- Mobile: 4 conceptual columns with `16px` gaps.
- Tablet: 8 conceptual columns with `20px` gaps.
- Desktop: 12 conceptual columns with `24px` gaps.
- Use grid or flex layout according to content; do not reproduce a print grid with empty wrapper elements.
- Prefer intrinsic breakpoints and container queries for reusable components. The page checkpoints in this document are verification widths, not permission to hard-code device-specific layouts.
- A component must define what collapses, wraps, scrolls, or moves before its minimum content width is reached.

## 5. Shape and depth

### 5.1 One card radius

- Canonical card radius: `--radius-card: 16px`.
- Cards, panels, dropdowns, modals, image frames, and elevated content should use `16px`.
- Small nested elements may use `8px` only when visually subordinate to a card.
- A circle is allowed for avatars, indicators, or icon-only controls.
- Organic or asymmetric shapes are reserved for editorial artwork, not commerce components.

### 5.2 One button radius

- Canonical button radius: `--radius-button: 999px`.
- Primary, secondary, and tertiary contained controls must share this radius.
- Icon-only buttons must be circular.
- Text links have no container radius.

### 5.3 Borders

- Default: `1px solid var(--border-subtle)`.
- Strong/selected: `1px solid var(--border-strong)`.
- Focus is expressed with the focus ring, not by changing layout-affecting border width.
- Decorative borders must be used sparingly and never compete with card content.
- Do not mix square, symmetric rounded, and asymmetric clipped borders within one journey.

### 5.4 Two shadow levels

| Token              | Value                               | Usage                                     |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| `--shadow-subtle`  | `0 8px 24px rgba(19, 42, 31, 0.07)` | Hovered card, sticky bar, quiet elevation |
| `--shadow-overlay` | `0 24px 64px rgba(8, 24, 16, 0.22)` | Modal, drawer, menu overlay               |

Resting product and editorial cards should normally use a border with no shadow. Never stack multiple shadows or invent route-specific shadow recipes.

## 6. Buttons and links

Only three button variants are approved.

### Primary

Use for the single most important action in a section or state: **Explore the current chapter**, **Add to cart**, **Buy now**, or **Checkout**.

- Filled Assam green surface
- White text
- Standard height `38px`; commerce buttons must not exceed `38px` unless they are full-width mobile checkout bars or accessibility accommodations outside the normal component shell
- Horizontal padding `16–20px`, adjusted for label length
- One primary action per visual group

### Secondary

Use for an important alternative that must remain visibly actionable.

- Transparent or paper surface
- Assam green text and `1px` strong border
- Same dimensions and typography as primary

### Tertiary

Use for lower-priority navigation such as **Our story →**, **View details**, or **Learn more**.

- Text-only
- Visible underline on hover and focus
- Arrow may reinforce direction but must not be the only affordance

### Button behavior

- All controls must have hover, active, focus-visible, loading, disabled, and error behavior where relevant.
- Commerce controls retain the dimensions established by their purchasing context; do not enlarge existing cards, pack selectors, filters, or purchase rows solely to meet a blanket target size.
- Primary storefront actions must not exceed `38px` in height unless an existing integration-owned control requires otherwise.
- Compact controls should preserve clear spacing from adjacent targets and provide an unambiguous focus state.
- Loading must preserve the button width and announce state to assistive technology.
- Disabled controls must explain why when the reason is not obvious.
- Destructive actions must not use the primary brand treatment.
- Links navigate; buttons change state or submit an action. Do not use a styled `<span>` as a button.

### Announcement bar

- The announcement strip is a deliberate compact exception: `20px` high with `10px` text. Any link must remain keyboard accessible and visibly focused.
- Show one message at a time. Rotation must pause on hover and keyboard focus and must stop under reduced-motion preferences.
- The announcement must not create cumulative layout shift after the page begins rendering.
- Delivery or promotion copy must come from the authoritative configured offer and must not hard-code a threshold that can drift from Shopify.

## 7. Card anatomy

Cards must have a defined job. Do not make every card an interactive container.

### Product card

Order:

1. Product image
2. Estate/origin or product type
3. Product title
4. Up to two short tasting cues or one concise description
5. Variant/pack selection when appropriate
6. Price and availability
7. Primary or secondary purchase action

Requirements:

- Product image and title may link to the PDP.
- Add to cart must be a real button.
- Avoid truncating meaningful copy to an arbitrary character count; use a two-line clamp with an accessible full name/title.
- Price, selected pack, and availability must remain visually connected.
- Wishlist is secondary and must not compete with the purchase action.

### Chapter card

Order:

1. Chapter media
2. Status label: current, open, upcoming, or next release
3. Chapter title
4. Estate/release description
5. Supporting availability information
6. Real link or button: **Explore Chapter**, **Notify me**, or **Join the Reserve List**

The card container itself should be non-interactive. Media controls, title links, and CTAs must remain independent so keyboard, touch, and assistive-technology behavior is predictable.

### Editorial card

Editorial cards may be quieter than commerce cards. They should use one image, one headline, one short summary, and one tertiary link. They must not imitate product cards if no purchase is possible.

## 8. Imagery

### Photography direction

- Prefer real Assam estates, people, process, leaf, liquor, packaging, and serving context.
- Preserve natural greens, soil, mist, brass, wood, paper, and tea-liquor warmth.
- Avoid generic stock tea imagery, artificial saturation, fake steam, excessive blur, and unrelated luxury props.
- Human subjects must be represented respectfully and contextually, never as decorative background texture.

### Approved aspect ratios

| Ratio  | Use                                            |
| ------ | ---------------------------------------------- |
| `16:9` | Wide editorial hero and estate landscape       |
| `4:3`  | Product cards, chapter media, collection cards |
| `4:5`  | Portrait storytelling and editorial features   |
| `1:1`  | Thumbnails, swatches, compact cart media       |

Choose one ratio per component family and preserve it across breakpoints. Images must use meaningful alternative text when informative and empty alternative text when purely decorative.

### Cropping

- Product packaging must not be cropped at labels, seals, or essential edges.
- Faces and hands must not be cut at awkward joints.
- The focal point must remain stable between responsive crops.
- Never stretch media or substitute a mismatched aspect ratio to fill space.

### Image delivery and stability

- Reserve image dimensions or an aspect ratio before media loads to prevent layout shift.
- Use Hydrogen's responsive image facilities with meaningful `sizes`; do not send desktop-sized images to narrow mobile slots.
- The LCP image must not be lazy-loaded and should receive appropriate fetch priority.
- Below-the-fold media should load lazily unless doing so would interrupt the next immediate interaction.
- Product imagery from Shopify remains authoritative. UI crops may change presentation but must not conceal material product information.

### 8.1 Iconography

- Use one consistent outline icon family with a nominal `24px` view box and visually consistent `1.5–2px` stroke.
- Standard visible sizes are `16px`, `20px`, and `24px`; the interactive target around an icon follows the target-size standard.
- Icons must not replace text where meaning is unfamiliar, commercial, irreversible, or safety-related.
- Do not use emoji as production interface icons for delivery, provenance, security, payment, or cart reassurance.
- Do not hand-draw one-off SVG interface icons when the approved icon family provides an equivalent.
- Directional icons must mirror in right-to-left interfaces when localization requires it.

## 9. Forms and controls

- Inputs, selects, and textareas should be `42–44px` high; multiline fields are exempt from fixed height. Fields may exceed the button height because text entry needs a larger readable interior.
- Standard commerce buttons are `38px` high. Variant/pack pills are `30–32px` high and must remain visibly subordinate to Add to cart, Buy now, and Checkout.
- Pack pills use compact rectangular corners rather than the full button pill radius; their text should normally be `12px` and their horizontal padding restrained.
- Icon buttons are `36–38px` square. The visible icon is normally `18–20px`.
- Targets must meet the WCAG 2.2 AA `24 × 24px` minimum or its qualifying spacing/inline exceptions. Adjacent compact controls require at least `4px` clear spacing and must not overlap.
- Persistent labels are required. Placeholder text is supplementary.
- Default body size inside controls is `16px`, preventing mobile browser zoom and improving legibility.
- Help text is `14px` minimum and appears before an error.
- Errors must identify the field, explain the problem, and state how to recover.
- Validate after blur or submit; do not interrupt while a customer is still typing unless safety requires it.
- Selected variant, unavailable variant, focused, loading, successful, and error states must be visually distinct without relying on colour alone.
- Quantity controls must announce the current quantity and respect Shopify availability.
- Filter and sort state must survive navigation when encoded in the URL.
- Native autofill, password managers, paste, and browser validation behavior must not be blocked.
- Authentication and checkout-related fields must expose appropriate `autocomplete`, input purpose, and keyboard type.
- Price, currency, quantity, and date presentation must use Shopify-provided currency/data and locale-aware formatting rather than concatenated symbols.

### Loading, empty, error, and success states

- Reserve the final component geometry during loading; skeletons should resemble content structure without animating under reduced motion.
- Never replace an actionable label with an ambiguous spinner alone. Preserve the action context, for example `Adding…`.
- Empty states must explain what is empty and provide one relevant recovery action.
- Partial Storefront API failure must preserve any still-usable content and clearly distinguish unavailable sections.
- Optimistic cart feedback may improve perceived speed, but it must reconcile with the Shopify cart response and visibly recover from failure.
- Success messages must confirm the completed action, not merely that a request was sent.
- Errors must remain visible until resolved or dismissed; brief toast messages are not sufficient for errors that block purchase.

## 10. Motion

### Motion principles

- Motion must clarify hierarchy, state, or brand—not prove that the page can animate.
- Only one ambient motion may dominate a viewport.
- User-triggered motion has priority over ambient motion.
- Content must remain usable when all animation is disabled.

### Timing

| Token                |      Duration | Use                                        |
| -------------------- | ------------: | ------------------------------------------ |
| `--motion-fast`      |       `120ms` | Pressed state, icon response               |
| `--motion-standard`  |       `200ms` | Hover, tab, disclosure, small state change |
| `--motion-slow`      |       `320ms` | Drawer, modal, major layout transition     |
| `--motion-signature` | `1200–3200ms` | One brand animation such as the hero river |

Use ease-out for entrances and ease-in for exits. Avoid bounce, elastic, and exaggerated parallax in commerce flows.

### Storefront motion hierarchy

- **Signature:** the hero river animation may remain as the primary brand motion.
- **Functional:** drawers, modals, tabs, cart feedback, and user-operated carousels should animate briefly.
- **Ambient:** steam or ripple may remain subtle in the hero, but auto-advancing carousels, autoplay video, moving marquees, and scroll-driven decorative seals should not run simultaneously.
- Chapter carousels should default to manual control. Video should play after user intent unless it is silent, nonessential, and demonstrably non-distracting.
- `prefers-reduced-motion: reduce` must disable nonessential animation, smooth scrolling, auto-advance, parallax, and animated transforms.
- Any moving, blinking, or auto-updating content that continues for more than five seconds must provide a mechanism to pause, stop, or hide it unless an applicable WCAG exception is documented.

## 11. Responsive and mobile behavior

Mobile is a prioritization mode, not a compressed desktop layout.

- Design from `320px` upward without horizontal page scrolling.
- Use a single content column by default.
- Preserve the current Chapter as the first homepage journey.
- The primary CTA should be visible without competing controls and should use the full available width when helpful.
- Purchase controls may use a sticky bottom bar only after the original controls leave the viewport.
- Sticky bars must respect safe-area insets and must not cover content, chat, validation, or cart feedback.
- Product galleries must provide stable aspect ratios to prevent layout shift.
- Filters should open in an accessible sheet or disclosure with visible applied-count and clear/reset actions.
- Hover-only information must have a touch and keyboard equivalent.
- Tables must reflow into labeled rows or provide intentional horizontal scrolling with a visible affordance.
- Avoid hiding decision-critical data merely to shorten the page.

Recommended layout checkpoints are `480px`, `768px`, `1024px`, and `1280px`. Components should respond to available space rather than targeting device brands.

Test critical purchase screens at minimum at `320px`, `375px`, `768px`, `1024px`, `1280px`, and `1440px`, plus one landscape mobile viewport. These are verification widths, not a mandate to add six media queries.

## 12. Accessibility standard

Target **WCAG 2.2 AA** for every production journey. Accessibility is a release criterion, not a later enhancement.

The storefront follows WCAG 2.2 AA target sizing: at least `24 × 24px`, or the standard's qualifying spacing and inline exceptions. Charaideo uses a compact ecommerce hierarchy rather than a universal `44 × 44px` rule: purchase buttons top out at `38px`, icon controls at `36–38px`, and variant pills at `30–32px`. Spacing, focus visibility and non-overlapping hit areas protect usability without making every control visually dominant.

### Required rules

- Text contrast: at least `4.5:1`; large text: at least `3:1`.
- Non-text UI and focus indicators: at least `3:1` against adjacent colours.
- Focus must be visible, ordered logically, and never trapped outside a modal.
- Every action must work by keyboard alone.
- Interactive targets must meet WCAG 2.2 AA sizing or qualifying spacing/inline exceptions. Dense adjacent commerce controls must retain at least `4px` clear separation and visible focus.
- Headings must follow a meaningful hierarchy with one clear page H1.
- Use native links, buttons, fields, lists, dialogs, and tables before ARIA roles.
- Never place interactive controls inside another interactive control.
- Icon-only controls require accessible names and visible tooltips where the icon is unfamiliar.
- Images require appropriate alternative text; decorative imagery uses `alt=""`.
- Form errors and async cart updates must be announced programmatically.
- Status, availability, and selection cannot rely on colour alone.
- Content must reflow at 320 CSS pixels and remain usable at 200% zoom.
- Motion must honor reduced-motion preferences.
- Modal focus must enter the modal, remain contained, and return to the trigger on close.
- Interfaces must remain understandable in forced-colours/high-contrast mode; do not remove native control appearance without supplying an equivalent visible boundary and state.
- Browser text spacing overrides must not clip or obscure content when letter spacing, word spacing, line height, and paragraph spacing are increased.
- Accessible names, roles, values, expanded state, selected state, and live updates must match the visible interface.

### Verification gates

Before release, each changed customer journey should be checked with:

1. Keyboard-only navigation
2. 200% browser zoom
3. 320px responsive reflow
4. Reduced-motion preference
5. Automated accessibility scan
6. Screen-reader spot check of navigation, product selection, cart, form errors, and modal behavior
7. Contrast verification for every new token pairing

Automated scans support review but do not constitute accessibility compliance.

## 12.1 Layering and overlays

Use a small semantic layer scale rather than arbitrary `z-index` values:

| Token            | Value | Use                                        |
| ---------------- | ----: | ------------------------------------------ |
| `--layer-base`   |   `0` | Normal page content                        |
| `--layer-raised` |  `10` | Sticky section controls and local badges   |
| `--layer-header` |  `30` | Site header and announcement               |
| `--layer-drawer` |  `50` | Navigation, cart, filters, search panels   |
| `--layer-modal`  |  `70` | Blocking dialogs and checkout confirmation |
| `--layer-toast`  |  `90` | Short non-blocking announcements           |

- Third-party widgets that require an external stacking context must be isolated and documented rather than forcing the application scale toward extreme values.
- Only one modal interaction layer may be active at a time.
- Overlays must lock background interaction without losing the user's scroll position.
- Toasts must not cover sticky purchase actions or essential error messages.

## 13. Content and commerce patterns

### Homepage hero

- Primary: **Explore the current chapter** or **Explore Chapter {number}**
- Tertiary: **Our story →**
- One supporting provenance statement is sufficient.
- The destination should reveal the current/open chapter first.

### Reserve List introduction

Use one concise sentence directly below the H1 and above the tabs:

> Discover limited estate releases by Chapter, or browse teas by Collection.

Do not add a second explanatory paragraph in the same area.

### New-release trust treatment

When a product has no verified reviews, use positive, sourced context near the title instead of emphasizing the absence of reviews:

1. `New release · {Estate name}`
2. Fallback: `New release · Single-estate Assam`
3. Fallback: `New release · Assam origin`

The normal empty-review invitation may remain in the reviews section. Never fabricate a rating, testimonial, or provenance claim.

### Tea guide

Preferred label: **Ask our tea guide**. Where users may expect conventional search, use the accessible description **Search teas or ask our tea guide**. Product results must remain directly navigable.

## 14. Anti-patterns

Avoid:

- text below `12px`, including badges and announcements;
- essential product information below `14px`;
- arbitrary values such as 7px labels, 11px body copy, or unique spacing for a single route;
- more than one card radius or button radius;
- route-specific shadow inventions;
- equally prominent primary and secondary actions;
- commerce buttons taller than `38px` in standard cards, panels or forms;
- pack selectors that are the same height, weight or prominence as Add to cart, Buy now or Checkout;
- editorial introductions that push price, availability, variants or purchase actions below avoidable content;
- clickable containers containing buttons, carousel dots, or other controls;
- styled `<span>` elements that look like buttons;
- auto-advancing carousels without pause controls;
- multiple ambient animations in one viewport;
- generic tea stock photography or decorative cultural clichés;
- fake urgency, unsupported scarcity, or invented provenance;
- decorative gradients where photography, spacing, or typography can provide hierarchy;
- excessive uppercase copy or tracking;
- low-contrast beige-on-white or green-at-low-opacity body text;
- hiding labels inside placeholders;
- layout shifts when images, reviews, recommendations, or cart data load;
- copying raw hex values into component styles;
- adding another stylesheet to solve a local override;
- using `!important` as a normal component strategy;
- exposing Shopify fields differently across cards and PDPs without a content reason.

## 14.1 Performance and resilience budgets

Visual quality includes speed and stability. A refined interface that shifts, blocks, or responds late is not complete.

- Protect Core Web Vitals with a product target of `LCP ≤ 2.5s`, `INP ≤ 200ms`, and `CLS ≤ 0.1` at the 75th percentile of real-user data.
- Reserve media, review, recommendation, announcement, and cart geometry before asynchronous content arrives.
- Defer recommendations, reviews, journals, and other noncritical content; product identity, selected variant, price, availability, and purchase controls are critical.
- Third-party scripts must load only where needed and must not delay the primary purchase journey.
- Use intent- or viewport-based prefetching selectively; do not prefetch every product link in a large collection.
- Avoid decorative JavaScript when CSS or a static composition can achieve the same result.
- A design change that materially increases image weight, JavaScript, font requests, or layout work requires a measured performance review.
- Font loading must use fallbacks with compatible metrics where practical and must not hide essential content.
- The UI must remain usable when reviews, recommendations, chat, analytics, or other nonessential third-party services fail.

## 15. Canonical implementation tokens

The eventual implementation should expose one shared token layer. This example is the target contract, not a requirement to migrate all styles at once:

```css
:root {
  --color-assam-green-900: #132a1f;
  --color-assam-green-700: #2f4d3e;
  --color-leaf-600: #5a6b62;
  --color-river-200: #e7ede0;
  --color-gamosa-100: #f5f1e6;
  --color-paper: #ffffff;
  --color-tea-500: #c4a484;
  --color-tea-800: #76552f;

  --surface-page: var(--color-paper);
  --surface-subtle: var(--color-gamosa-100);
  --surface-inverse: var(--color-assam-green-900);
  --text-primary: var(--color-assam-green-900);
  --text-secondary: var(--color-leaf-600);
  --text-accent: var(--color-tea-800);
  --text-inverse: var(--color-paper);
  --border-subtle: var(--color-river-200);
  --border-strong: rgb(19 42 31 / 32%);
  --action-primary: var(--color-assam-green-900);
  --action-primary-hover: #0b1d15;
  --focus-ring: var(--color-assam-green-900);

  --font-editorial: 'Libre Baskerville', Baskerville, Georgia, serif;
  --font-interface: 'Instrument Sans', Inter, system-ui, sans-serif;

  --type-label: 0.75rem;
  --type-metadata: 0.875rem;
  --type-body: 1rem;
  --type-body-large: 1.125rem;
  --type-card-title: clamp(1.375rem, 1.8vw, 1.75rem);
  --type-section-title: clamp(2.25rem, 3.5vw, 3.25rem);
  --type-page-title: clamp(3rem, 5vw, 4.5rem);
  --type-display: clamp(3.5rem, 6vw, 5.5rem);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;
  --space-9: 6rem;
  --space-10: 8rem;

  --radius-card: 1rem;
  --radius-control: 0.5rem;
  --radius-button: 999px;
  --control-height-compact: 2rem;
  --control-height-standard: 2.375rem;
  --field-height: 2.75rem;
  --shadow-subtle: 0 8px 24px rgb(19 42 31 / 7%);
  --shadow-overlay: 0 24px 64px rgb(8 24 16 / 22%);

  --content-narrow: 45rem;
  --content-standard: 70rem;
  --content-wide: 80rem;
  --content-max: 90rem;

  --motion-fast: 120ms;
  --motion-standard: 200ms;
  --motion-slow: 320ms;

  --layer-base: 0;
  --layer-raised: 10;
  --layer-header: 30;
  --layer-drawer: 50;
  --layer-modal: 70;
  --layer-toast: 90;
}
```

## 16. Governance and review

### Source of truth

This document owns design decisions. The implementation token file will own values after migration. Components must consume those tokens rather than redefining them.

### Adding a token or variant

A new token or component variant must answer all of the following:

1. What recurring user or product need does it solve?
2. Why can the existing token or variant not solve it?
3. Does it remain accessible in all required states?
4. Will it be reused in at least three credible places, or is it a justified one-off editorial exception?
5. Which existing token or variant can be retired to keep the system small?

### Definition of done for UI work

A UI change is complete only when:

- it uses canonical tokens and approved component variants;
- desktop and mobile behavior are specified;
- loading, empty, error, disabled, success, and unavailable states are handled where relevant;
- keyboard, zoom, reflow, contrast, and reduced-motion checks pass;
- Shopify data remains authoritative;
- no new arbitrary radius, shadow, font size, colour, or spacing value is introduced;
- the changed screen has been visually reviewed at representative mobile and desktop sizes.
- performance-sensitive changes have been compared against the existing route rather than judged only by a successful build.

## 17. Migration plan

The migration should be incremental and must not change Shopify logic.

### Phase 1 — Foundation

1. Create one shared token stylesheet.
2. Map legacy variables to canonical tokens temporarily.
3. Establish font sizes, spacing, radii, shadows, focus, and target-size rules.
4. Add lint/review guidance against raw colours and arbitrary values.

### Phase 2 — Highest-conversion components

1. Buttons and links
2. Form controls and variant selectors
3. Product and chapter cards
4. Product purchase panel and mobile purchase bar
5. Cart drawer and cart summary

### Phase 3 — Core journeys

1. Homepage hero and current Chapter
2. Reserve List tabs, search, filters, and cards
3. Product details, provenance, reviews, and recommendations
4. Cart, account, policy, and contact surfaces

### Phase 4 — Consolidation

1. Remove migrated rules from the generated homepage artifact stylesheet.
2. Reduce duplication between `identity.css`, `revamp.css`, and route styles.
3. Remove obsolete aliases and `!important` overrides.
4. Retire unsupported radii, shadows, small type, and ambient motion.
5. Document approved component examples and regression-test the purchase journey.

Do not begin by rewriting all CSS. Migrate one component family at a time, visually verify it, and remove only the superseded rules whose consumers are known.

## 18. Success measures

The design system succeeds when:

- a first-time visitor can identify the current Chapter and reach a purchasable tea without explanation;
- price, pack size, availability, delivery context, and purchase action are legible at a glance;
- no production UI text is below the documented minimums;
- cards and controls look related across homepage, Reserve List, PDP, and cart;
- keyboard and mobile users can complete the same purchase journey;
- visual changes no longer require new route-specific radii, shadows, and one-off font sizes;
- the storefront feels unmistakably Assamese because of its real content and art direction, not generic luxury decoration.

## 19. Review record and authoritative references

Version 1.2 was re-reviewed as an ecommerce system. It replaces the universal 44px control rule with a compact WCAG 2.2 AA hierarchy: 30–32px pack selectors, 36–38px icon controls, 38px purchase buttons, and 42–44px text-entry fields. It also makes price, pack, stock and purchase actions the primary product-scanning unit, with editorial content serving the buying decision.

Authoritative references:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Understanding WCAG contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html)
- [Shopify performance best practices for Hydrogen storefronts](https://shopify.dev/docs/storefronts/themes/best-practices/performance/hydrogen-performance)

These references establish minimum standards. Charaideo may deliberately exceed them where doing so improves touch usability, clarity, trust, or purchase completion.
