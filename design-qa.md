# Reserve List design QA

- Source visual truth: `C:\Users\kamal\Downloads\charaideo_reserve_list_sidebar_2cards.html` (structural reference only; its typography and CSS were explicitly excluded)
- Implementation: `/reserve-list` in the local Hydrogen storefront
- Intended desktop viewport: 1440 × 1000 CSS px at 1× density
- Intended mobile viewport: 390 × 844 CSS px at 1× density
- State: all chapters by default; all collections by default; mobile browse drawer closed
- Implementation screenshot: unavailable
- Source screenshot: unavailable; the supplied HTML structure was inspected directly

## Full-view comparison evidence

Blocked. The Shopify CLI development server failed before startup with `uv_os_get_passwd returned ENOMEM`. The Vite-only development server started, but the configured in-app browser surface is unavailable, so no browser-rendered screenshot could be captured.

## Focused-region comparison evidence

Blocked for the same reason. The desktop sidebar, accordion states, multi-select collection controls, results summary, and mobile drawer could not be visually compared in a browser.

## Findings

- No code-level P0/P1/P2 issue was found by TypeScript, ESLint, unit tests, or the production build.
- Browser rendering, overflow, sticky positioning, and live interaction states remain unverified.
- Fonts and typography: existing project font tokens were retained; browser rendering is unverified.
- Spacing and layout rhythm: new sidebar uses the existing Reserve List spacing, border, radius, and color language; browser rendering is unverified.
- Colors and visual tokens: existing Reserve List tokens are used; browser contrast rendering is unverified.
- Image quality and asset fidelity: existing product imagery and cards are unchanged; no new image assets or approximations were introduced.
- Copy and content: labels follow the approved “Shop by Chapters” and “Shop by Collection” structure.

## Primary interactions requiring browser verification

- Expand and collapse both sidebar cards.
- Show all chapters and select one chapter.
- Select and deselect multiple collections.
- Reset to all collections.
- Combine sidebar navigation with search, sort, availability, tea-style, and price filters.
- Open, use, and dismiss the mobile browse drawer by its close control and backdrop.
- Confirm keyboard focus visibility and tab order.

## Comparison history

- Initial implementation: code validation passed; visual comparison blocked because no browser surface was available.

## Final result

final result: blocked
# Homepage hero responsive design QA

## Comparison target

- Source visual truth: `audit/hero-responsive/04-landscape-844x390.png` (the pre-fix failure captured from the running storefront).
- Implementation: `audit/hero-responsive/05-landscape-fixed-844x390.png`.
- Combined comparison: `audit/hero-responsive/08-landscape-before-after.png`.
- Viewport: 844 × 390 CSS pixels.
- Pixel dimensions: source 844 × 390; implementation 844 × 390.
- Density normalization: both captures use device scale factor 1 and the same unframed browser-content crop.
- State: homepage at initial load with the video hero visible.

## Full-view comparison evidence

The pre-fix capture clips the complete CTA row and proof line behind the bottom marquee. The post-fix capture keeps the primary and secondary CTAs visible in the initial landscape viewport. The hero is allowed to grow vertically, so the nonessential proof line and marquee follow below the fold instead of covering conversion content.

The video remains the same live asset with the same poster, muted, loop, and plays-inline behavior. Differences in the visible video frame between captures are expected because the source is a playing video.

## Required fidelity surfaces

- Fonts and typography: existing font families, weights, tracking, and copy are unchanged. A height-only responsive clamp reduces display size on short viewports without changing normal desktop or portrait-mobile typography.
- Spacing and layout rhythm: normal 1440 × 900 and 390 × 844 compositions retain the one-screen top-strip-to-marquee layout. At heights of 600px or less, content height wins over the decorative fold constraint.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: the original video source, poster, crop rules, filters, transforms, overlay, and image assets are unchanged.
- Copy and content: unchanged.

## Interaction and browser verification

- Browser-rendered implementation verified at 1440 × 900, 390 × 844, and 844 × 390.
- Primary “Explore the Reserve” CTA clicked successfully and reached `#chapter-collection`.
- Browser console checked after the interaction: no errors.
- Production build and TypeScript validation completed successfully.

## Findings and comparison history

- [P1, resolved] Short landscape viewports clipped the CTA row and proof content.
  - Fix: replaced the unexplained height literal with named fold-component variables and added a final height-safety breakpoint. On short viewports the hero uses content-driven height, clears the overlay header, removes the desktop copy offset, and keeps the CTA visible.
  - Post-fix evidence: `audit/hero-responsive/05-landscape-fixed-844x390.png`.
- No remaining actionable P0, P1, or P2 findings.

## Focused-region comparison

No additional crop was needed: the 844 × 390 full-view comparison renders the header, complete text hierarchy, CTA row, video crop, and fold boundary at readable scale.

## Follow-up polish

- P3: if the promotional strip or marquee height becomes merchant-configurable, expose those values through shared shell-level CSS custom properties instead of the current documented defaults.

final result: passed
