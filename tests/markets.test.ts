import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCheckoutCountrySupported,
  marketCookie,
  resolveStorefrontI18n,
} from '../app/lib/markets.ts';

test('storefront market follows Oxygen buyer country for localized prices', () => {
  assert.deepEqual(
    resolveStorefrontI18n(
      new Request('https://www.charaideoreserves.com/products/tea', {
        headers: {'oxygen-buyer-country': 'gb'},
      }),
    ),
    {language: 'EN', country: 'GB'},
  );
});

test('storefront market safely defaults to India without valid Oxygen geolocation', () => {
  assert.deepEqual(
    resolveStorefrontI18n(new Request('https://www.charaideoreserves.com/')),
    {language: 'EN', country: 'IN'},
  );
  assert.deepEqual(
    resolveStorefrontI18n(
      new Request('https://www.charaideoreserves.com/', {
        headers: {'oxygen-buyer-country': 'XX'},
      }),
    ),
    {language: 'EN', country: 'IN'},
  );
  assert.deepEqual(
    resolveStorefrontI18n(
      new Request('http://localhost:3000/', {
        headers: {'oxygen-buyer-country': 'US'},
      }),
    ),
    {language: 'EN', country: 'IN'},
  );
});

test('root exposes the resolved buyer country for storefront checkout eligibility', async () => {
  const source = await import('node:fs/promises').then(({readFile}) =>
    readFile(new URL('../app/root.tsx', import.meta.url), 'utf8'),
  );

  assert.match(source, /buyerCountry: storefront\.i18n\.country/);
  assert.match(
    source,
    /checkoutCountrySupported: isCheckoutCountrySupported\(storefront\.i18n\.country\)/,
  );
});

test('checkout UI supports India only', () => {
  assert.equal(isCheckoutCountrySupported('IN'), true);
  assert.equal(isCheckoutCountrySupported('CA'), false);
  assert.equal(isCheckoutCountrySupported('US'), false);
});

test('explicit market choice overrides Oxygen geolocation', () => {
  assert.deepEqual(
    resolveStorefrontI18n(
      new Request('https://www.charaideoreserves.com/', {
        headers: {cookie: 'cr_market=CA', 'oxygen-buyer-country': 'RO'},
      }),
    ),
    {language: 'EN', country: 'CA'},
  );
  assert.match(marketCookie('IN'), /^cr_market=IN;/);
  assert.match(marketCookie('US'), /^cr_market=US;/);
  assert.throws(() => marketCookie('XX'));
});
