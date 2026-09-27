import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStorefrontNotices,
  type StorefrontNoticeMetaobject,
} from '../app/lib/storefront-notices.ts';

function entry(
  overrides: Partial<StorefrontNoticeMetaobject> = {},
): StorefrontNoticeMetaobject {
  return {
    id: 'notice-1',
    message: {value: 'Free Delivery Above ₹499/-'},
    buttonLabel: {value: 'Shop now →'},
    buttonLink: {
      value: JSON.stringify({
        text: 'Shop now',
        url: 'https://charaideoreserves.com/reserve-list',
      }),
    },
    enabled: {value: 'true'},
    displayOrder: {value: '2'},
    startsAt: {value: '2026-09-09T17:30:00Z'},
    endsAt: {value: '2026-11-26T17:30:00Z'},
    tone: {value: 'warm'},
    ...overrides,
  };
}

test('maps an active Shopify link field into a sorted notice', () => {
  const notices = parseStorefrontNotices(
    [entry()],
    new Date('2026-09-27T12:00:00Z'),
  );

  assert.deepEqual(notices, [
    {
      id: 'notice-1',
      message: 'Free Delivery Above ₹499/-',
      buttonLabel: 'Shop now →',
      buttonLink: 'https://charaideoreserves.com/reserve-list',
      displayOrder: 2,
      tone: 'warm',
    },
  ]);
});

test('filters disabled, future, and expired notices', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  assert.deepEqual(
    parseStorefrontNotices(
      [
        entry({id: 'disabled', enabled: {value: 'false'}}),
        entry({id: 'future', startsAt: {value: '2026-10-01T00:00:00Z'}}),
        entry({id: 'expired', endsAt: {value: '2026-09-01T00:00:00Z'}}),
      ],
      now,
    ),
    [],
  );
});

test('rejects unsafe links and uses Shopify link text as the label fallback', () => {
  const [safe, unsafe] = parseStorefrontNotices(
    [
      entry({
        id: 'safe',
        buttonLabel: null,
        buttonLink: {value: JSON.stringify({text: 'Browse', url: '/reserve-list'})},
      }),
      entry({
        id: 'unsafe',
        buttonLink: {value: JSON.stringify({text: 'Bad', url: 'javascript:alert(1)'})},
      }),
    ],
    new Date('2026-09-27T12:00:00Z'),
  );

  assert.equal(safe.buttonLabel, 'Browse');
  assert.equal(safe.buttonLink, '/reserve-list');
  assert.equal(unsafe.buttonLink, null);
});
