import assert from 'node:assert/strict';
import test from 'node:test';

import {loadShopifyDiscountProgress} from '../../app/lib/shopify-discounts.server.ts';

test('Shopify discount progress parses 2026 buyer context, fixed amounts, and percentages', async () => {
  const originalFetch = globalThis.fetch;
  let adminQuery = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(
      String(input),
      'https://discount-progress-test.myshopify.com/admin/api/2026-07/graphql.json',
    );
    const body = JSON.parse(String(init?.body)) as {query: string};
    adminQuery = body.query;

    return Response.json({
      data: {
        discountNodes: {
          nodes: [
            {
              id: 'gid://shopify/DiscountNode/fixed',
              discount: {
                __typename: 'DiscountAutomaticBasic',
                title: '₹100 off',
                status: 'ACTIVE',
                context: {all: 'ALL'},
                discountClasses: ['ORDER'],
                minimumRequirement: {
                  __typename: 'DiscountMinimumSubtotal',
                  greaterThanOrEqualToSubtotal: {
                    amount: '1499.00',
                    currencyCode: 'INR',
                  },
                },
                customerGets: {
                  items: {allItems: true},
                  value: {
                    amount: {amount: '100.00', currencyCode: 'INR'},
                    appliesOnEachItem: false,
                  },
                },
              },
            },
            {
              id: 'gid://shopify/DiscountNode/percentage',
              discount: {
                __typename: 'DiscountCodeBasic',
                title: '15% off',
                status: 'ACTIVE',
                context: {all: 'ALL'},
                discountClasses: ['ORDER'],
                minimumRequirement: {
                  __typename: 'DiscountMinimumSubtotal',
                  greaterThanOrEqualToSubtotal: {
                    amount: '2499.00',
                    currencyCode: 'INR',
                  },
                },
                customerGets: {
                  items: {allItems: true},
                  value: {percentage: 0.15},
                },
                codes: {nodes: [{code: 'SAVE15'}]},
              },
            },
          ],
        },
      },
    });
  }) as typeof fetch;

  try {
    const progress = await loadShopifyDiscountProgress(
      {
        SHOPIFY_ADMIN_STORE_DOMAIN: 'discount-progress-test.myshopify.com',
        SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-token',
        SHOPIFY_ADMIN_API_VERSION: '2026-07',
      } as Env,
      null,
    );

    assert.equal(progress.status, 'ready');
    assert.deepEqual(
      progress.milestones.map(({threshold, reward, method, codes}) => ({
        threshold,
        reward,
        method,
        codes,
      })),
      [
        {
          threshold: 1499,
          reward: '₹100.00 off',
          method: 'automatic',
          codes: [],
        },
        {
          threshold: 2499,
          reward: '15% off',
          method: 'code',
          codes: ['SAVE15'],
        },
      ],
    );
    assert.match(adminQuery, /\.\.\. on DiscountBuyerSelectionAll\s*\{\s*all\s*\}/);
    assert.doesNotMatch(adminQuery, /DiscountCustomerAll|allCustomers/);
    assert.match(adminQuery, /\.\.\. on DiscountAmount\s*\{/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
