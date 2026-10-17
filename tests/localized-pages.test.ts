import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('international content pages prefer Shopify and retain the coded fallback', async () => {
  const source = await readFile('app/routes/pages.$handle.tsx', 'utf8');
  assert.match(source, /staticPage && context\.locale\.key === 'en-in'/);
  assert.match(source, /@inContext\(language: \$language, country: \$country\)/);
  assert.match(source, /if \(!page && staticPage\)/);
  assert.doesNotMatch(source, /FrenchAboutStoryPage/);
  assert.doesNotMatch(source, /STATIC_PAGES_FR/);
});
