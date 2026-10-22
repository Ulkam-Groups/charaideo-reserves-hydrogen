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
  assert.match(css, /border-radius: var\(--radius-button\)/);
  assert.match(css, /box-shadow: var\(--shadow-overlay\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(
    css,
    /header-solid:not\(\.header-scrolled\) \.header-inner[\s\S]*border-radius: var\(--radius-card\)/,
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

  assert.match(css, /label\[data-selected="true"\] span::before/);
  assert.match(css, /content: '✓'/);
  assert.match(css, /color: #d9aa45/);
});
