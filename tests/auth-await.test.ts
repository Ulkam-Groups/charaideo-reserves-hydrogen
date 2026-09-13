import test from 'node:test';
import assert from 'node:assert/strict';

import {requireCustomerAuthStatus} from '../app/lib/customer-auth.server.ts';

for (const name of ['profile', 'addresses', 'fallback']) {
  test(`${name} loader auth guard awaits Customer Account auth status`, async () => {
    let release!: () => void;
    let completed = false;
    const authStatus = new Promise<void>((resolve) => {
      release = () => {
        completed = true;
        resolve();
      };
    });

    const result = requireCustomerAuthStatus({handleAuthStatus: () => authStatus});

    await Promise.resolve();
    assert.equal(completed, false);
    release();
    await result;
    assert.equal(completed, true);
  });
}
