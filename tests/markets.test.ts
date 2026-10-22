import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStorefrontI18n} from '../app/lib/markets.ts';

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
});
