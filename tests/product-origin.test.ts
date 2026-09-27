import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRODUCT_ORIGIN_LABEL,
  getProductOriginLabel,
} from '../app/lib/product-origin.ts';

test('uses the value from an origin-label product tag', () => {
  assert.equal(
    getProductOriginLabel([
      'black-tea',
      'origin-label: Darjeeling / 27.04° N',
    ]),
    'Darjeeling / 27.04° N',
  );
});

test('matches the origin-label prefix case-insensitively', () => {
  assert.equal(
    getProductOriginLabel([' Origin-Label:  Sikkim / 27.53° N ']),
    'Sikkim / 27.53° N',
  );
});

test('uses the Assam fallback when the tag is absent or empty', () => {
  assert.equal(getProductOriginLabel(['black-tea']), DEFAULT_PRODUCT_ORIGIN_LABEL);
  assert.equal(getProductOriginLabel(['origin-label:  ']), DEFAULT_PRODUCT_ORIGIN_LABEL);
  assert.equal(getProductOriginLabel(), DEFAULT_PRODUCT_ORIGIN_LABEL);
});
