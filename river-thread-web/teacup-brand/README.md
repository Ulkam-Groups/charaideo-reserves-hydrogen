# Charaideo teacup brand asset set

This is a non-destructive derivative of the existing River Thread illustration
family. It uses `river-thread-mark-teacup-no-saucer.svg` as the master mark.

## Contents

- `svg/`: scalable production assets for About, Cart, Contact, Header, Catalog,
  and product badges.
- `png/`: fixed-size previews/exports matching the original artwork dimensions.
- `manifest.json`: dimensions, family names, and whether the master teacup mark
  is embedded in each illustration.

The five compositions that previously contained the gold leaf accent now use
the cup-only mark. All other artwork is copied without visual changes so the
family remains compositionally consistent.

`header-quiet-light.svg` is the dark-surface footer treatment: cream lettering,
a pale river thread, a gold reserve accent, and the original tea-liquor cup.

The Hydrogen storefront still points to the original assets. This folder is a
review-ready alternative and can be integrated page by page after approval.

## Pouch concepts

`packaging-variations/` contains five minimalist front-panel directions for a
130 mm × 210 mm flat-bottom stand-up pouch with zipper. The concepts use only
River Mist, Gamosa Cream, and Assam Red and are documented in that folder's
README and manifest.

Regenerate the SVG set from the repository root with:

```shell
node scripts/build-teacup-brand-assets.mjs
```

Render the matching PNG exports on Windows with Chrome or Edge installed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render-teacup-brand-pngs.ps1
```
