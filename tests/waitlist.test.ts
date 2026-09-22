import assert from 'node:assert/strict';
import test from 'node:test';
import {saveWaitlistSubscriber, WaitlistError} from '../app/lib/waitlist.server.ts';

const env = {
  PUBLIC_STORE_DOMAIN: 'example.myshopify.com',
  WRIT_TO_CUSTOMER_CLIENT_ID: 'test-client',
  WRIT_TO_CUSTOMER_CLIENT_SECRET: 'test-secret',
};

test('new email creates one subscribed Chapter I customer', async () => {
  const calls: {query: string; variables: Record<string, unknown>}[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    if (
      init?.headers &&
      'Content-Type' in init.headers &&
      init.headers['Content-Type'] === 'application/x-www-form-urlencoded'
    ) {
      return Response.json({access_token: 'test-token'});
    }
    const request = JSON.parse(String(init?.body));
    calls.push(request);
    if (request.query.includes('query WaitlistCustomer')) {
      return Response.json({data: {customers: {nodes: []}}});
    }
    return Response.json({
      data: {
        customerCreate: {
          customer: {id: 'gid://shopify/Customer/1', email: 'tea@example.com'},
          userErrors: [],
        },
      },
    });
  };

  assert.deepEqual(await saveWaitlistSubscriber(' Tea@Example.com ', env, fetcher), {
    ok: true,
  });
  assert.equal(calls.length, 2);
  assert.equal((calls[1].variables.input as {email: string}).email, 'tea@example.com');
  assert.deepEqual((calls[1].variables.input as {tags: string[]}).tags, [
    'waitlist',
    'chapter-1-waitlist',
  ]);
  assert.equal(
    (
      calls[1].variables.input as {
        emailMarketingConsent: {marketingState: string};
      }
    ).emailMarketingConsent.marketingState,
    'SUBSCRIBED',
  );
});

test('existing customer gets tags added and consent updated without replacing tags', async () => {
  const operations: string[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    if (String(init?.body).includes('grant_type=client_credentials')) {
      return Response.json({access_token: 'test-token'});
    }
    const {query} = JSON.parse(String(init?.body));
    if (query.includes('query WaitlistCustomer')) {
      return Response.json({
        data: {
          customers: {
            nodes: [
              {
                id: 'gid://shopify/Customer/1',
                email: 'tea@example.com',
              },
            ],
          },
        },
      });
    }
    operations.push(query);
    if (query.includes('tagsAdd')) {
      return Response.json({data: {tagsAdd: {userErrors: []}}});
    }
    return Response.json({data: {customerEmailMarketingConsentUpdate: {userErrors: []}}});
  };

  assert.deepEqual(await saveWaitlistSubscriber('tea@example.com', env, fetcher), {
    ok: true,
  });
  assert.equal(operations.length, 2);
  assert.match(operations[0], /tagsAdd/);
  assert.match(operations[1], /customerEmailMarketingConsentUpdate/);
});

test('GraphQL errors prevent false signup success', async () => {
  const fetcher: typeof fetch = async (_input, init) =>
    String(init?.body).includes('grant_type=client_credentials')
      ? Response.json({access_token: 'test-token'})
      : Response.json({errors: [{message: 'Access denied'}]});
  await assert.rejects(
    saveWaitlistSubscriber('tea@example.com', env, fetcher),
    WaitlistError,
  );
});
