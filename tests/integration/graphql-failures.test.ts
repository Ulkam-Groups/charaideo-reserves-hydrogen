import assert from 'node:assert/strict';
import test from 'node:test';

import {loader as policiesLoader} from '../../app/routes/policies._index';
import {loader as policyLoader} from '../../app/routes/policies.$handle';
import {loader as accountLoader} from '../../app/routes/account';
import {
  loader as profileLoader,
  action as profileAction,
} from '../../app/routes/account.profile';
import {action as addressAction} from '../../app/routes/account.addresses';

function request(method: string, body: Record<string, string>) {
  return new Request('https://store.example/account', {
    method,
    headers: {Origin: 'https://store.example'},
    body: new URLSearchParams(body),
  });
}

function deferred<T>() {
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return {promise, reject};
}

test('Storefront GraphQL 200 with errors cannot produce a successful policies page', async () => {
  const graphqlError = new Error('GraphQL errors in HTTP 200 response');
  await assert.rejects(
    policiesLoader({
      context: {
        storefront: {
          query: async () => {
            throw graphqlError;
          },
        },
      },
    } as any),
    graphqlError,
  );
});

test('Storefront timeout propagates instead of rendering stale policy data', async () => {
  const pending = deferred<never>();
  const result = policiesLoader({
    context: {storefront: {query: () => pending.promise}},
  } as any);
  pending.reject(new DOMException('Timed out', 'TimeoutError'));
  await assert.rejects(result, {name: 'TimeoutError'});
});

test('all four policy routes render when Shopify has no published policy records', async () => {
  const handles = [
    'privacy-policy',
    'refund-policy',
    'shipping-policy',
    'terms-of-service',
  ];
  const context = {storefront: {query: async () => ({shop: {}})}};

  for (const handle of handles) {
    const {policy} = await policyLoader({params: {handle}, context} as any);
    assert.equal(policy.handle, handle);
    assert.ok(policy.title);
    assert.match(policy.body, /contact@ulkamgroup\.com/);
  }

  const {policies} = await policiesLoader({context} as any);
  assert.deepEqual(
    policies.map((policy) => policy.handle),
    handles,
  );
});

test('each policy route displays its published Shopify title and body', async () => {
  const fields = {
    'privacy-policy': 'privacyPolicy',
    'refund-policy': 'refundPolicy',
    'shipping-policy': 'shippingPolicy',
    'terms-of-service': 'termsOfService',
  } as const;

  for (const [handle, field] of Object.entries(fields)) {
    const {policy} = await policyLoader({
      params: {handle},
      context: {
        storefront: {
          query: async () => ({
            shop: {
              [field]: {title: `Published ${handle}`, body: '<p>Merchant terms</p>'},
            },
          }),
        },
      },
    } as any);
    assert.equal(policy.title, `Published ${handle}`);
    assert.equal(policy.body, '<p>Merchant terms</p>');
  }
});

test('Customer Account GraphQL 200 with errors rejects even when customer data exists', async () => {
  await assert.rejects(
    accountLoader({
      context: {
        customerAccount: {
          i18n: {language: 'EN'},
          query: async () => ({
            data: {customer: {id: 'customer-1'}},
            errors: [{message: 'Expired token'}],
          }),
        },
      },
    } as any),
    /Customer not found/,
  );
});

test('Customer Account query timeout is propagated', async () => {
  const pending = deferred<never>();
  const result = accountLoader({
    context: {
      customerAccount: {i18n: {language: 'EN'}, query: () => pending.promise},
    },
  } as any);
  pending.reject(new DOMException('Timed out', 'TimeoutError'));
  await assert.rejects(result, {name: 'TimeoutError'});
});

test('expired account session blocks the profile loader', async () => {
  const expired = new Response(null, {
    status: 302,
    headers: {Location: '/account/login'},
  });
  await assert.rejects(
    profileLoader({
      context: {
        customerAccount: {
          handleAuthStatus: async () => {
            throw expired;
          },
        },
      },
    } as any),
    (error: unknown) => error === expired,
  );
});

test('profile update treats HTTP 200 GraphQL errors as a failed update', async () => {
  const result = await profileAction({
    request: request('PUT', {firstName: 'Test'}),
    context: {
      customerAccount: {
        i18n: {language: 'EN'},
        mutate: async () => ({
          data: {customerUpdate: {customer: {id: 'customer-1'}}},
          errors: [{message: 'Denied'}],
        }),
      },
    },
  } as any);
  assert.ok('init' in result);
  assert.equal(result.init?.status, 400);
  assert.match(result.data.error, /Unable to update your profile/);
});

test('address mutation surfaces userErrors from an HTTP 200 response', async () => {
  const result = await addressAction({
    request: request('POST', {addressId: 'NEW_ADDRESS_ID', firstName: 'Test'}),
    context: {
      customerAccount: {
        i18n: {language: 'EN'},
        isLoggedIn: async () => true,
        mutate: async () => ({
          data: {customerAddressCreate: {userErrors: [{message: 'Invalid postal code'}]}},
        }),
      },
    },
  } as any);
  assert.ok('init' in result);
  assert.equal(result.init?.status, 400);
  assert.equal(result.data.error.NEW_ADDRESS_ID, 'Invalid postal code');
});

test('expired session blocks address mutation before GraphQL is called', async () => {
  let called = false;
  const result = await addressAction({
    request: request('PUT', {addressId: 'address-1', city: 'Guwahati'}),
    context: {
      customerAccount: {
        isLoggedIn: async () => false,
        mutate: async () => {
          called = true;
        },
      },
    },
  } as any);
  assert.ok('init' in result);
  assert.equal(result.init?.status, 401);
  assert.equal(result.data.error['address-1'], 'Unauthorized');
  assert.equal(called, false);
});

test('address timeout returns a retryable error without claiming success', async () => {
  const result = await addressAction({
    request: request('DELETE', {addressId: 'address-1'}),
    context: {
      customerAccount: {
        i18n: {language: 'EN'},
        isLoggedIn: async () => true,
        mutate: async () => {
          throw new DOMException('Timed out', 'TimeoutError');
        },
      },
    },
  } as any);
  assert.ok('init' in result);
  assert.equal(result.init?.status, 400);
  assert.match(result.data.error['address-1'], /Unable to delete/);
});
