import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../app/styles/design-system.css', import.meta.url);
const componentUrl = new URL('../app/components/DesignSystem.tsx', import.meta.url);
const shellUrl = new URL('../app/styles/shell.css', import.meta.url);
const merchandisingUrl = new URL('../app/styles/merchandising.css', import.meta.url);

test('design system exposes the canonical visual contract', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const requiredTokens = [
    '--color-assam-green-900',
    '--color-tea-800',
    '--surface-page',
    '--text-primary',
    '--action-primary',
    '--font-editorial',
    '--font-interface',
    '--type-label: 0.75rem',
    '--type-metadata: 0.875rem',
    '--type-body: 1rem',
    '--space-10',
    '--radius-card: 1rem',
    '--radius-button: 999px',
    '--control-height-compact: 2rem',
    '--control-height-standard: 2.375rem',
    '--field-height: 2.75rem',
    '--shadow-subtle',
    '--shadow-overlay',
    '--content-wide',
    '--motion-standard',
    '--layer-modal',
  ];

  for (const token of requiredTokens) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('design system limits buttons and depth to the approved variants', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const components = await readFile(componentUrl, 'utf8');

  assert.match(components, /type ButtonVariant = 'primary' \| 'secondary' \| 'tertiary'/);
  assert.match(css, /\.ds-button--primary/);
  assert.match(css, /\.ds-button--secondary/);
  assert.match(css, /\.ds-button--tertiary/);
  assert.doesNotMatch(css, /--shadow-(?!subtle|overlay)[a-z-]+:/);
});

test('design-system primitives include accessibility fallbacks', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const components = await readFile(componentUrl, 'utf8');

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /min-height: var\(--field-height\)/);
  assert.match(components, /tone === 'critical' \? 'alert' : 'status'/);
});

test('global shell follows the readable type and target-size contract', async () => {
  const css = await readFile(shellUrl, 'utf8');

  assert.match(css, /font-size: var\(--type-label\)/);
  assert.match(css, /font-size: var\(--type-metadata\)/);
  assert.match(css, /min-height: var\(--control-height-standard\)/);
  assert.match(
    css,
    /\.site-header\.header \.wordmark img \{[\s\S]*filter: (?:brightness\([^)]+\) )?contrast\([^)]+\) saturate\([^)]+\)/,
  );
  assert.match(
    css,
    /button\.header-search-trigger \{[\s\S]*width: clamp\(13rem, 20vw, 20rem\)[\s\S]*border: 1px solid var\(--border-strong\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 75rem\) \{[\s\S]*\.header-search-label,[\s\S]*display: none/,
  );
  assert.match(css, /border-radius: var\(--radius-button\)/);
  assert.match(css, /box-shadow: var\(--shadow-overlay\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(
    css,
    /header-solid:not\(\.header-scrolled\) \.header-inner[\s\S]*border: 1px solid #[0-9a-f]{6}[\s\S]*border-radius: 26px[\s\S]*background: #ffffff/,
  );
  assert.match(
    css,
    /header-solid\.header-scrolled \.header-inner[\s\S]*border-radius: 0/,
  );
  assert.match(css, /margin: 0 0 calc\(-1 \* var\(--header-height\)\)/);
  assert.match(css, /height: var\(--header-height\)/);
  assert.match(css, /--notice-height: 1\.25rem/);
  assert.match(css, /font-size: 0\.625rem/);
  assert.match(css, /\.notice-board-item[\s\S]*height: 100%/);
});

test('P2 product cards use the canonical readable commerce contract', async () => {
  const css = await readFile(merchandisingUrl, 'utf8');

  assert.match(css, /border-radius: var\(--radius-card\)/);
  assert.match(css, /font: 400 var\(--type-metadata\)/);
  assert.match(css, /-webkit-line-clamp: 3/);
  assert.match(css, /min-height: var\(--control-height-standard\)/);
  assert.match(css, /min-height: var\(--control-height-compact\)/);
  assert.match(css, /border-radius: var\(--radius-button\)/);
  assert.match(css, /\.home-product-card/);
  assert.match(css, /grid-auto-columns: clamp\(20rem, 23vw, 23rem\)/);
  assert.match(css, /font-size: 1\.0625rem/);
  assert.match(css, /min-height: 1\.875rem/);
  assert.match(css, /\.home-product-card-variants input:focus-visible \+ span/);
  assert.match(css, /label\[data-selected='true'\] span::before/);
  assert.match(css, /color: #d9aa45/);
  assert.match(
    css,
    /\.home-product-card > \.wishlist-button[\s\S]*min-height: var\(--control-height-compact\)/,
  );
});

test('Reserve List selected pack uses the gold confirmation mark', async () => {
  const css = await readFile(
    new URL('../app/assets/reserve-list.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /label\[data-available="true"\]\[data-selected="true"\] span::before/,
  );
  assert.match(
    css,
    /label\[data-available="false"\]:has\(input:checked\) span::before \{content: none\}/,
  );
  assert.match(css, /content: '✓'/);
  assert.match(css, /color: #d9aa45/);
});

test('P3 buy box normalizes small text without resizing its controls', async () => {
  const css = await readFile(
    new URL('../app/styles/product-experience.css', import.meta.url),
    'utf8',
  );

  assert.match(css, /P3 purchase typography/);
  assert.match(css, /\.product-purchase \.product-options h5[\s\S]*font-size: 10\.5px/);
  assert.match(
    css,
    /\.product-purchase \.product-form > \[role='status'\][\s\S]*font-size: 11px/,
  );
});

test('P3 purchase states remain visually distinct', async () => {
  const [css, form] = await Promise.all([
    readFile(new URL('../app/styles/product-experience.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/ProductForm.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(form, /data-available=\{available\}/);
  assert.match(css, /\.product-purchase \.product-stock--sold-out/);
  assert.match(css, /\.product-options-item\[data-available='false'\]/);
  assert.match(css, /\.product-purchase \.product-form > \[role='alert'\]/);
});

test('P3 delivery and reassurance retain compact geometry with readable states', async () => {
  const css = await readFile(
    new URL('../app/styles/product-experience.css', import.meta.url),
    'utf8',
  );

  assert.match(css, /P3 delivery and reassurance typography/);
  assert.match(
    css,
    /\.product-purchase \.delivery-estimate-result p,[\s\S]*font-size: 11px !important/,
  );
  assert.match(css, /\.product-purchase \.delivery-estimate-error/);
  assert.match(css, /\.product-purchase \.product-mobile-purchase-bar/);
});

test('P3 gallery keeps its geometry and uses a real cursor-relative zoom origin', async () => {
  const [css, component] = await Promise.all([
    readFile(new URL('../app/styles/product-experience.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/ProductImage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(component, /const zoomX = \(\(event\.clientX - rect\.left\)/);
  assert.match(component, /const zoomY = \(\(event\.clientY - rect\.top\)/);
  assert.doesNotMatch(component, /setProperty\('--zoom-[xy]', `%`\)/);
  assert.match(css, /P3 gallery interaction/);
  assert.match(css, /\.product-purchase \.product-thumbnail\[aria-pressed='true'\]/);
  assert.match(
    css,
    /\.product-purchase \.product-thumbnail\[aria-pressed='true'\][\s\S]*transform: none/,
  );
});

test('P3 provenance improves hierarchy without changing Shopify content', async () => {
  const [css, component] = await Promise.all([
    readFile(new URL('../app/styles/product-experience.css', import.meta.url), 'utf8'),
    readFile(
      new URL('../app/components/ProductEditorialSections.tsx', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(css, /P3 provenance/);
  assert.match(
    css,
    /\.tea-record-section \.tea-record-highlights dt[\s\S]*font-size: 11px/,
  );
  assert.match(component, /\['Origin', product\.origin\?\.value\]/);
  assert.match(component, /\['Estate', product\.estate\?\.value\]/);
  assert.match(component, /\['Harvest', harvest\]/);
});

test('P3 reviews and editorial guidance use readable commerce typography', async () => {
  const [css, reviews] = await Promise.all([
    readFile(new URL('../app/styles/product-experience.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/ProductReviews.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(css, /P3 reviews, editorial guidance and related discovery/);
  assert.match(css, /\.product-page \.product-review-card > p,[\s\S]*font-size: 14px/);
  assert.match(
    css,
    /\.product-page \.product-review-card-topline,[\s\S]*font-size: 12px/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*product-reviews-loading/,
  );
  assert.match(reviews, /aria-label={`\$\{rating\.toFixed\(1\)\} out of 5 stars`}/);
});

test('P5 contact and About surfaces use compact actions and explicit form states', async () => {
  const [revamp, about, route] = await Promise.all([
    readFile(new URL('../app/styles/revamp.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles/about-story-page.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/routes/pages.$handle.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(revamp, /\.contact-page \.button \{[\s\S]*min-height: 38px/);
  assert.match(revamp, /:user-invalid/);
  assert.match(revamp, /:user-valid/);
  assert.match(about, /\.about-page-button \{[\s\S]*min-height: 38px/);
  assert.match(route, /reply within two business days/i);
  assert.doesNotMatch(route, /reply within one business day/i);
});

test('P5 Tea Academy uses compact ecommerce navigation and a continuous surface', async () => {
  const css = await readFile(
    new URL('../app/styles/tea-academy.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /P5 Academy navigation: compact ecommerce-style secondary navigation/,
  );
  assert.match(css, /\.academy-section-menu \{[\s\S]*min-height: 50px/);
  assert.match(css, /\.academy-section-menu-label \{[\s\S]*text-transform: uppercase/);
  assert.match(css, /\.academy-section-menu small \{[\s\S]*display: none/);
  assert.match(
    css,
    /\.academy-page,[\s\S]*\.academy-manifesto \{[\s\S]*background: #ffffff/,
  );
});
