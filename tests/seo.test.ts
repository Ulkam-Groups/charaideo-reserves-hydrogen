import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  brandedMetaDescription,
  breadcrumbJsonLd,
  canonicalUrl,
  domesticShippingDetailsJsonLd,
  domesticShippingServiceJsonLd,
  metaDescription,
  merchantReturnPolicyJsonLd,
  organizationJsonLd,
  parentOrganizationJsonLd,
} from '../app/lib/seo.ts';

test('merchant policies describe the published India fulfillment rules', () => {
  const paidShipping = domesticShippingDetailsJsonLd(398.99);
  const freeShipping = domesticShippingDetailsJsonLd(399);

  assert.equal(merchantReturnPolicyJsonLd.applicableCountry, 'IN');
  assert.equal(
    merchantReturnPolicyJsonLd.returnPolicyCategory,
    'https://schema.org/MerchantReturnNotPermitted',
  );
  assert.equal(
    merchantReturnPolicyJsonLd.merchantReturnLink,
    'https://teareserves.com/policies/refund-policy',
  );
  assert.equal(paidShipping.shippingDestination.addressCountry, 'IN');
  assert.equal(paidShipping.shippingRate.value, 60);
  assert.equal(paidShipping.shippingRate.currency, 'INR');
  assert.equal(freeShipping.shippingRate.value, 0);
  assert.deepEqual(paidShipping.deliveryTime.handlingTime, {
    '@type': 'QuantitativeValue',
    minValue: 2,
    maxValue: 4,
    unitCode: 'DAY',
  });
  assert.equal(paidShipping.deliveryTime.transitTime.maxValue, 10);
  assert.equal(
    domesticShippingServiceJsonLd.shippingConditions[0].orderValue.maxValue,
    398.99,
  );
  assert.equal(domesticShippingServiceJsonLd.shippingConditions[1].shippingRate.value, 0);
  assert.equal(organizationJsonLd.hasMerchantReturnPolicy, merchantReturnPolicyJsonLd);
  assert.equal(organizationJsonLd.hasShippingService, domesticShippingServiceJsonLd);
});

test('canonical URLs always use the primary production HTTPS host', () => {
  assert.equal(canonicalUrl('/'), 'https://teareserves.com/');
  assert.equal(
    canonicalUrl('/products/assam-tea'),
    'https://teareserves.com/products/assam-tea',
  );
});

test('meta descriptions are normalized and limited to 160 characters', () => {
  assert.equal(metaDescription('  Assam   tea  ', 'Fallback'), 'Assam tea');
  assert.ok(metaDescription('x'.repeat(200), 'Fallback').length <= 160);
  assert.equal(metaDescription('', 'Fallback'), 'Fallback');
});

test('branded descriptions promote both brand levels without exceeding limits', () => {
  const description = brandedMetaDescription(
    'A traceable single-estate Assam tea.',
    'Discover Assam tea.',
  );

  assert.match(description, /Tea Reserves of India/);
  assert.ok(description.length <= 160);
  assert.equal(
    organizationJsonLd.parentOrganization['@id'],
    parentOrganizationJsonLd['@id'],
  );
  assert.ok(organizationJsonLd.knowsAbout.includes('Assam tea'));
  assert.ok(organizationJsonLd.knowsAbout.includes('Indian tea'));
  assert.match(organizationJsonLd.slogan, /single-origin Assam tea/i);
});

test('breadcrumb structured data uses absolute canonical item URLs', () => {
  const schema = breadcrumbJsonLd([
    {name: 'Home', path: '/'},
    {name: 'Tea Academy', path: '/tea-academy'},
  ]);

  assert.equal(schema['@type'], 'BreadcrumbList');
  assert.equal(schema.itemListElement[1]?.position, 2);
  assert.equal(schema.itemListElement[1]?.item, 'https://teareserves.com/tea-academy');
});

test('sitemap only advertises implemented resource types and routes', async () => {
  const indexRoute = await readFile(
    new URL('../app/routes/[sitemap.xml].tsx', import.meta.url),
    'utf8',
  );
  const childRoute = await readFile(
    new URL('../app/routes/sitemap.$type.$page[.xml].tsx', import.meta.url),
    'utf8',
  );

  assert.match(indexRoute, /types: \['products', 'pages'\]/);
  assert.doesNotMatch(indexRoute, /'collections'|'blogs'|'articles'|'metaObjects'/);
  assert.doesNotMatch(childRoute, /EN-US|EN-CA|FR-CA/);
  assert.match(childRoute, /TEA_JOURNAL_SITEMAP_QUERY/);
  assert.match(childRoute, /\/tea-academy\/journal\/\$\{article\.handle\}/);
  assert.match(childRoute, /\/reserve-list/);
});

test('robots allows public policy pages while protecting private routes', async () => {
  const robotsRoute = await readFile(
    new URL('../app/routes/[robots.txt].tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(robotsRoute, /Disallow: \/policies\//);
  assert.match(robotsRoute, /Disallow: \/cart/);
  assert.match(robotsRoute, /Disallow: \/checkout/);
  assert.match(robotsRoute, /Disallow: \/account/);
});

test('catch-all route renders a useful noindex page with a real 404 status', async () => {
  const catchAllRoute = await readFile(
    new URL('../app/routes/$.tsx', import.meta.url),
    'utf8',
  );

  assert.match(catchAllRoute, /\{status: 404\}/);
  assert.match(catchAllRoute, /noindex,follow/);
  assert.match(catchAllRoute, /Explore the Tea Shop/);
  assert.match(catchAllRoute, /Return home/);
});
