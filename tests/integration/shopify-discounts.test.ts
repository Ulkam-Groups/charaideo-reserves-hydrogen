import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {DiscountProgress} from '../../app/components/DiscountProgress.tsx';
import {loadShopifyDiscountProgress} from '../../app/lib/shopify-discounts.server.ts';
import {
  discountProgressAmount,
  isDiscountProgressEligible,
} from '../../app/lib/discount-progress.ts';

test('Shopify discount progress parses order and product milestones in threshold order', async () => {
  const originalFetch = globalThis.fetch;
  const adminQueries: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(
      String(input),
      'https://discount-progress-test.myshopify.com/admin/api/2026-07/graphql.json',
    );
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables?: {id?: string};
    };
    adminQueries.push(body.query);

    if (body.query.includes('query StorefrontProgressDiscountTargets')) {
      if (body.variables?.id === 'gid://shopify/DiscountNode/collection-percent') {
        return Response.json({
          data: {
            discountNode: {
              discount: {
                customerGets: {
                  items: {
                    __typename: 'DiscountCollections',
                    collections: {
                      nodes: [{id: 'gid://shopify/Collection/eligible'}],
                    },
                  },
                },
              },
            },
          },
        });
      }
      return Response.json({
        data: {
          discountNode: {
            discount: {
              customerGets: {
                items: {
                  __typename: 'DiscountProducts',
                  products: {
                    nodes: [{id: 'gid://shopify/Product/eligible'}],
                  },
                  productVariants: {nodes: []},
                },
              },
            },
          },
        },
      });
    }

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
              id: 'gid://shopify/DiscountNode/product-fixed',
              discount: {
                __typename: 'DiscountAutomaticBasic',
                title: '₹200 off selected products',
                status: 'ACTIVE',
                context: {all: 'ALL'},
                discountClasses: ['PRODUCT'],
                minimumRequirement: {
                  __typename: 'DiscountMinimumSubtotal',
                  greaterThanOrEqualToSubtotal: {
                    amount: '1999.00',
                    currencyCode: 'INR',
                  },
                },
                customerGets: {
                  items: {__typename: 'DiscountProducts'},
                  value: {
                    amount: {amount: '200.00', currencyCode: 'INR'},
                    appliesOnEachItem: false,
                  },
                },
              },
            },
            {
              id: 'gid://shopify/DiscountNode/collection-percent',
              discount: {
                __typename: 'DiscountAutomaticBasic',
                title: '25% off selected collection',
                status: 'ACTIVE',
                context: {all: 'ALL'},
                discountClasses: ['PRODUCT'],
                minimumRequirement: {
                  __typename: 'DiscountMinimumSubtotal',
                  greaterThanOrEqualToSubtotal: {
                    amount: '1799.00',
                    currencyCode: 'INR',
                  },
                },
                customerGets: {
                  items: {__typename: 'DiscountCollections'},
                  value: {percentage: 0.25},
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
          threshold: 1799,
          reward: '25% off',
          method: 'automatic',
          codes: [],
        },
        {
          threshold: 1999,
          reward: '₹200.00 off',
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
    const productMilestone = progress.milestones.find(
      ({id}) => id === 'gid://shopify/DiscountNode/product-fixed',
    );
    assert.ok(productMilestone);
    assert.equal(productMilestone.productSpecific, true);
    assert.deepEqual(productMilestone.targets, {
      allItems: false,
      productIds: ['gid://shopify/Product/eligible'],
      variantIds: [],
      collectionIds: [],
    });
    assert.equal(progress.milestones[0]?.productSpecific, false);
    const collectionMilestone = progress.milestones.find(
      ({id}) => id === 'gid://shopify/DiscountNode/collection-percent',
    );
    assert.ok(collectionMilestone);
    assert.deepEqual(collectionMilestone.targets, {
      allItems: false,
      productIds: [],
      variantIds: [],
      collectionIds: ['gid://shopify/Collection/eligible'],
    });
    assert.equal(
      isDiscountProgressEligible(productMilestone, [
        {
          productId: 'gid://shopify/Product/eligible',
          variantId: 'gid://shopify/ProductVariant/1',
          collectionIds: [],
          amount: 500,
          currencyCode: 'INR',
        },
      ]),
      true,
    );
    assert.equal(
      isDiscountProgressEligible(productMilestone, [
        {
          productId: 'gid://shopify/Product/not-eligible',
          variantId: 'gid://shopify/ProductVariant/2',
          collectionIds: [],
          amount: 500,
          currencyCode: 'INR',
        },
      ]),
      false,
    );
    assert.equal(
      discountProgressAmount(productMilestone, [
        {
          productId: 'gid://shopify/Product/eligible',
          variantId: 'gid://shopify/ProductVariant/1',
          collectionIds: [],
          amount: 650,
          currencyCode: 'INR',
        },
        {
          productId: 'gid://shopify/Product/not-eligible',
          variantId: 'gid://shopify/ProductVariant/2',
          collectionIds: [],
          amount: 1000,
          currencyCode: 'INR',
        },
      ]),
      650,
    );
    assert.equal(
      discountProgressAmount(progress.milestones[0], [
        {
          productId: 'gid://shopify/Product/eligible',
          variantId: 'gid://shopify/ProductVariant/1',
          collectionIds: [],
          amount: 650,
          currencyCode: 'INR',
        },
        {
          productId: 'gid://shopify/Product/not-eligible',
          variantId: 'gid://shopify/ProductVariant/2',
          collectionIds: [],
          amount: 1000,
          currencyCode: 'INR',
        },
      ]),
      1650,
    );
    assert.equal(
      isDiscountProgressEligible(collectionMilestone, [
        {
          productId: 'gid://shopify/Product/other',
          variantId: 'gid://shopify/ProductVariant/3',
          collectionIds: ['gid://shopify/Collection/eligible'],
          amount: 500,
          currencyCode: 'INR',
        },
      ]),
      true,
    );
    assert.equal(
      isDiscountProgressEligible(
        {
          ...productMilestone,
          targets: {
            allItems: false,
            productIds: [],
            variantIds: ['gid://shopify/ProductVariant/eligible'],
            collectionIds: [],
          },
        },
        [
          {
            productId: 'gid://shopify/Product/other',
            variantId: 'gid://shopify/ProductVariant/eligible',
            collectionIds: [],
            amount: 500,
            currencyCode: 'INR',
          },
        ],
      ),
      true,
    );
    assert.match(adminQueries[0], /\.\.\. on DiscountBuyerSelectionAll\s*\{\s*all\s*\}/);
    assert.doesNotMatch(adminQueries[0], /DiscountCustomerAll|allCustomers/);
    assert.match(adminQueries[0], /\.\.\. on DiscountAmount\s*\{/);
    assert.match(adminQueries[0], /__typename/);
    assert.equal(
      adminQueries[0].match(/minimumRequirement\s*\{\s*__typename/g)?.length,
      4,
    );
    assert.equal(adminQueries.length, 3);
    assert.match(adminQueries[1], /DiscountProducts/);
    assert.match(adminQueries[2], /DiscountCollections/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cart progress counts only items targeted by each Shopify discount', () => {
  const html = renderToStaticMarkup(
    createElement(DiscountProgress, {
      surface: 'cart',
      status: 'ready',
      items: [
        {
          productId: 'gid://shopify/Product/eligible',
          variantId: 'gid://shopify/ProductVariant/eligible',
          collectionIds: [],
          amount: 650,
          currencyCode: 'INR',
        },
        {
          productId: 'gid://shopify/Product/unrelated',
          variantId: 'gid://shopify/ProductVariant/unrelated',
          collectionIds: [],
          amount: 1000,
          currencyCode: 'INR',
        },
      ],
      milestones: [
        {
          id: 'free-shipping',
          threshold: 499,
          currencyCode: 'INR',
          reward: 'Free shipping',
          title: 'Free shipping',
          method: 'automatic',
          codes: [],
          productSpecific: false,
          targets: {
            allItems: true,
            productIds: [],
            variantIds: [],
            collectionIds: [],
          },
        },
        {
          id: 'selected-products',
          threshold: 1499,
          currencyCode: 'INR',
          reward: '15% off',
          title: '15% off selected teas',
          method: 'automatic',
          codes: [],
          productSpecific: true,
          targets: {
            allItems: false,
            productIds: ['gid://shopify/Product/eligible'],
            variantIds: [],
            collectionIds: [],
          },
        },
      ],
    }),
  );

  assert.match(html, /Free shipping unlocked/);
  assert.match(html, /849\.00/);
  assert.match(html, /to reach 15% off/);
  assert.match(html, /role="progressbar"/);
  assert.doesNotMatch(html, /15% off reached/);
});
