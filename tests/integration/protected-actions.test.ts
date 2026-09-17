import assert from 'node:assert/strict';
import test from 'node:test';

import {action as profileAction} from '../../app/routes/account.profile';
import {action as addressAction} from '../../app/routes/account.addresses';
import {action as logoutAction} from '../../app/routes/account_.logout';

function unsafeRequest(path: string) {
  return new Request(`https://store.example${path}`, {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'addressId=NEW_ADDRESS_ID',
  });
}

test('cross-origin address write is rejected before Customer Account mutation', async () => {
  let called = false;
  const response = await addressAction({
    request: unsafeRequest('/account/addresses'),
    context: {
      customerAccount: {
        isLoggedIn: async () => true,
        mutate: async () => {
          called = true;
        },
      },
    },
  } as any);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test('unsupported profile write is rejected before Customer Account mutation', async () => {
  let called = false;
  const response = await profileAction({
    request: new Request('https://store.example/account/profile', {
      method: 'PUT',
      headers: {Origin: 'https://store.example', 'Content-Type': 'application/json'},
      body: '{}',
    }),
    context: {
      customerAccount: {
        mutate: async () => {
          called = true;
        },
      },
    },
  } as any);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 415);
  assert.equal(called, false);
});

test('cross-origin logout cannot end the session', async () => {
  let called = false;
  const response = await logoutAction({
    request: unsafeRequest('/account/logout'),
    context: {
      customerAccount: {
        logout: async () => {
          called = true;
        },
      },
    },
  } as any);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 403);
  assert.equal(called, false);
});
