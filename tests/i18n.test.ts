import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectSuggestedLocale,
  localeFromRequest,
  switchLocalePath,
} from '../app/lib/i18n.ts';

test('preserves existing India URLs as the default locale', () => {
  assert.equal(localeFromRequest(new Request('https://example.com/products/tea')).key, 'en-in');
});

test('uses the saved locale for unprefixed navigation during the session', () => {
  assert.equal(
    localeFromRequest(new Request('https://example.com/pages/about-us'), 'fr-ca').key,
    'fr-ca',
  );
});

test('an explicit URL locale overrides the saved session locale', () => {
  assert.equal(
    localeFromRequest(new Request('https://example.com/en-us/pages/about-us'), 'fr-ca').key,
    'en-us',
  );
});

test('resolves each supported international prefix', () => {
  assert.deepEqual(
    ['en-us', 'en-ca', 'fr-ca'].map((prefix) =>
      localeFromRequest(new Request(`https://example.com/${prefix}/products/tea`)).key,
    ),
    ['en-us', 'en-ca', 'fr-ca'],
  );
});

test('switching locales preserves route and useful query parameters', () => {
  assert.equal(
    switchLocalePath('/en-us/collections/tea?sort=PRICE&page=2&country=US', 'fr-ca'),
    '/fr-ca/collections/tea?sort=PRICE&page=2',
  );
  assert.equal(switchLocalePath('/fr-ca/products/tea?Size=100g', 'en-in'), '/products/tea?Size=100g');
});

test('supports local detection testing and production edge country headers', () => {
  assert.equal(detectSuggestedLocale(new Request('https://example.com/?country=CA', {headers: {'accept-language': 'fr-CA'}})), 'fr-ca');
  assert.equal(detectSuggestedLocale(new Request('https://example.com/', {headers: {'cf-ipcountry': 'US'}})), 'en-us');
});
