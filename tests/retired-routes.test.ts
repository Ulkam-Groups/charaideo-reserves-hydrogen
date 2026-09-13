import test from 'node:test';
import assert from 'node:assert/strict';

import {action as blendCheckout} from '../app/routes/api.blend-checkout.ts';
import {action as staffMutation} from '../app/routes/api.admin.teas.ts';

test('custom blend checkout is permanently retired', async () => {
  const response = blendCheckout();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('unfinished staff mutation endpoint is not exposed', () => {
  const response = staffMutation();
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
