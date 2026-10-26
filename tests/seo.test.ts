import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  brandedMetaDescription,
  breadcrumbJsonLd,
  canonicalUrl,
  metaDescription,
  organizationJsonLd,
  parentOrganizationJsonLd,
} from '../app/lib/seo.ts';

test('canonical URLs always use the production HTTPS www host', () => {
  assert.equal(canonicalUrl('/'), 'https://www.teareserves.com/');
  assert.equal(
    canonicalUrl('/products/assam-tea'),
    'https://www.teareserves.com/products/assam-tea',
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
  assert.equal(
    schema.itemListElement[1]?.item,
    'https://www.teareserves.com/tea-academy',
  );
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
