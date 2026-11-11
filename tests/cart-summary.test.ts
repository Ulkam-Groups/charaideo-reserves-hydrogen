import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('cart drawer displays Shopify payable total after discount codes', async () => {
  const source = await readFile(
    new URL('../app/components/CartSummary.tsx', import.meta.url),
    'utf8',
  );
  const asideStart = source.indexOf("if (layout === 'aside')");
  const pageStart = source.indexOf('\n  return (', asideStart);
  const asideSummary = source.slice(asideStart, pageStart);

  assert.ok(asideStart >= 0 && pageStart > asideStart);
  assert.match(
    asideSummary,
    /<Money data=\{cart\.cost\.totalAmount\} \/>/,
    'manual order-level discounts must be reflected in the drawer amount',
  );
  assert.doesNotMatch(
    asideSummary,
    /<Money data=\{cart\.cost\.subtotalAmount\} \/>/,
    'the pre-discount subtotal must not be shown as the payable drawer amount',
  );
});
