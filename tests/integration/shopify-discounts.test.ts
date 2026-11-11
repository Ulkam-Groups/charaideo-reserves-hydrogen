import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {DiscountProgress} from '../../app/components/DiscountProgress.tsx';
import {loadShopifyDiscountProgress} from '../../app/lib/shopify-discounts.server.ts';
import {
  cartDiscountProgressItems,
  combinableDiscountMilestones,
  discountProgressAmount,
  incompatibleDiscountMilestoneIds,
  isDiscountProgressEligible,
} from '../../app/lib/discount-progress.ts';

test('cart discount progress ignores an incomplete optimistic line', () => {
  assert.deepEqual(
    cartDiscountProgressItems({
      lines: {
        nodes: [
          {
            quantity: 1,
            merchandise: {
              id: 'gid://shopify/ProductVariant/optimistic',
              price: {amount: '450.00', currencyCode: 'INR'},
            },
          },
        ],
      },
    } as never),
    [],
  );
});

test('non-combinable order code suppresses a reached free-shipping offer', () => {
  const freeShipping = {
    id: 'free-shipping',
    threshold: 399,
    currencyCode: 'INR' as const,
    reward: 'Free shipping',
    title: 'Free shipping',
    method: 'automatic' as const,
    codes: [],
    discountClasses: ['SHIPPING'],
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    productSpecific: false,
    targets: {
      allItems: true,
      productIds: [],
      variantIds: [],
      collectionIds: [],
    },
  };

  assert.deepEqual(
    combinableDiscountMilestones(
      [freeShipping],
      ['TESTLOGISTIC1'],
      [{
        id: 'test-logistic-1',
        codes: ['TESTLOGISTIC1'],
        discountClasses: ['ORDER'],
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      }],
    ),
    [],
  );
  assert.deepEqual(
    incompatibleDiscountMilestoneIds(
      [freeShipping],
      ['TESTLOGISTIC1'],
      [{
        id: 'test-logistic-1',
        codes: ['TESTLOGISTIC1'],
        discountClasses: ['ORDER'],
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      }],
    ),
    ['free-shipping'],
  );
});

test('cart progress keeps incompatible offers visible and labels them unavailable', () => {
  const milestones = [
    {
      id: 'free-shipping',
      threshold: 399,
      currencyCode: 'INR' as const,
      reward: 'Free shipping',
      title: 'Free shipping',
      method: 'automatic' as const,
      codes: [],
      discountClasses: ['SHIPPING'],
      productSpecific: false,
      targets: {allItems: true, productIds: [], variantIds: [], collectionIds: []},
    },
    {
      id: 'ten-percent',
      threshold: 1099,
      currencyCode: 'INR' as const,
      reward: '10% off',
      title: '10% off',
      method: 'automatic' as const,
      codes: [],
      discountClasses: ['ORDER'],
      productSpecific: false,
      targets: {allItems: true, productIds: [], variantIds: [], collectionIds: []},
    },
  ];
  const html = renderToStaticMarkup(
    createElement(DiscountProgress, {
      surface: 'cart',
      status: 'ready',
      items: [{
        productId: 'product',
        variantId: 'variant',
        collectionIds: [],
        amount: 1410,
        currencyCode: 'INR',
      }],
      milestones,
      unavailableMilestoneIds: ['free-shipping', 'ten-percent'],
    }),
  );

  assert.match(html, /0 of 2 offers applicable/);
  assert.match(html, /₹399\.00 Free shipping · not applicable/);
  assert.match(html, /₹1,099\.00 10% off · not applicable/);
  assert.match(html, /Not applicable with applied discount/);
  assert.doesNotMatch(html, /Conditions met/);
});

test('mutually combinable order code preserves a free-shipping offer', () => {
  const freeShipping = {
    id: 'free-shipping',
    threshold: 399,
    currencyCode: 'INR' as const,
    reward: 'Free shipping',
    title: 'Free shipping',
    method: 'automatic' as const,
    codes: [],
    discountClasses: ['SHIPPING'],
    combinesWith: {
      orderDiscounts: true,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    productSpecific: false,
    targets: {
      allItems: true,
      productIds: [],
      variantIds: [],
      collectionIds: [],
    },
  };

  assert.equal(
    combinableDiscountMilestones(
      [freeShipping],
      ['SAVE10'],
      [{
        id: 'save-10',
        codes: ['SAVE10'],
        discountClasses: ['ORDER'],
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: true,
        },
      }],
    ).length,
    1,
  );
});

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
                    nodes: [
                      {
                        id: 'gid://shopify/Product/eligible',
                        title: 'Green Pearl Reserve',
                      },
                    ],
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
                combinesWith: {
                  orderDiscounts: false,
                  productDiscounts: false,
                  shippingDiscounts: false,
                },
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
            {
              id: 'gid://shopify/DiscountNode/test-logistic-1',
              discount: {
                __typename: 'DiscountCodeBasic',
                title: 'TESTLOGISTIC1',
                status: 'ACTIVE',
                context: {all: 'ALL'},
                discountClasses: ['ORDER'],
                combinesWith: {
                  orderDiscounts: false,
                  productDiscounts: false,
                  shippingDiscounts: false,
                },
                minimumRequirement: {__typename: 'DiscountMinimumQuantity'},
                customerGets: {
                  items: {allItems: true},
                  value: {percentage: 0.8},
                },
                codes: {nodes: [{code: 'TESTLOGISTIC1'}]},
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
    assert.deepEqual(progress.milestones[0]?.combinesWith, {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    });
    assert.deepEqual(
      progress.codeDiscounts?.find(({codes}) => codes.includes('TESTLOGISTIC1')),
      {
        id: 'gid://shopify/DiscountNode/test-logistic-1',
        codes: ['TESTLOGISTIC1'],
        discountClasses: ['ORDER'],
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      },
    );
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
      adminQueries[0].match(/combinesWith\s*\{/g)?.length,
      4,
      'combination rules are requested for every supported discount type',
    );
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

test('cart progress distinguishes a met offer from the offer Shopify actually applied', () => {
  const items = [
    {
      productId: 'gid://shopify/Product/matcha',
      variantId: 'gid://shopify/ProductVariant/matcha',
      collectionIds: [],
      amount: 2_070,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/tea',
      variantId: 'gid://shopify/ProductVariant/tea',
      collectionIds: [],
      amount: 1_556,
      currencyCode: 'INR' as const,
    },
  ];
  const noCombinations = {
    orderDiscounts: false,
    productDiscounts: false,
    shippingDiscounts: false,
  };
  const milestones = [
    {
      id: 'ten-percent',
      threshold: 1_499,
      currencyCode: 'INR' as const,
      reward: '10% off',
      title: 'Get 10% off on order above 1499',
      method: 'automatic' as const,
      codes: [],
      discountClasses: ['PRODUCT'],
      combinesWith: noCombinations,
      eligibleItems: {
        kind: 'products' as const,
        labels: ['Assam Hojicha Reserve', 'Green Pearl Reserve'],
      },
      productSpecific: true,
      targets: {
        allItems: false,
        productIds: ['gid://shopify/Product/tea'],
        variantIds: [],
        collectionIds: [],
      },
    },
    {
      id: 'twenty-percent',
      threshold: 1_999,
      currencyCode: 'INR' as const,
      reward: '20% off',
      title: 'Save 20% when you buy Matcha',
      method: 'automatic' as const,
      codes: [],
      discountClasses: ['PRODUCT'],
      combinesWith: noCombinations,
      productSpecific: true,
      targets: {
        allItems: false,
        productIds: ['gid://shopify/Product/matcha'],
        variantIds: [],
        collectionIds: [],
      },
    },
  ];

  const html = renderToStaticMarkup(
    createElement(DiscountProgress, {
      surface: 'cart',
      status: 'ready',
      items,
      milestones,
      appliedMilestoneIds: ['twenty-percent'],
    }),
  );

  assert.match(html, /A better offer has been applied/);
  assert.match(html, /20% off applied/);
  assert.doesNotMatch(html, /10% off applied/);
  assert.match(html, /Eligible products only \(2\)/);
  assert.match(html, /Assam Hojicha Reserve/);
  assert.match(html, /Green Pearl Reserve/);
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

  assert.match(html, /<strong>Free shipping<\/strong><span>Conditions met<\/span>/);
  assert.match(html, /Whole cart/);
  assert.match(html, /Eligible products only/);
  assert.match(html, /849\.00/);
  assert.match(html, /for 15% off/);
  assert.equal((html.match(/class="discount-progress-group"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /15% off reached/);
});

test('discount progress keeps overlapping product, variant, and collection thresholds independent', () => {
  const items = [
    {
      productId: 'gid://shopify/Product/a',
      variantId: 'gid://shopify/ProductVariant/a1',
      collectionIds: ['gid://shopify/Collection/seasonal'],
      amount: 600,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/b',
      variantId: 'gid://shopify/ProductVariant/b1',
      collectionIds: [],
      amount: 900,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/c',
      variantId: 'gid://shopify/ProductVariant/c1',
      collectionIds: ['gid://shopify/Collection/seasonal'],
      amount: 1_200,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/a',
      variantId: 'gid://shopify/ProductVariant/a2',
      collectionIds: ['gid://shopify/Collection/seasonal'],
      amount: 100,
      currencyCode: 'USD' as const,
    },
  ];
  const base = {
    threshold: 1_000,
    currencyCode: 'INR' as const,
    reward: '10% off',
    title: 'Offer',
    method: 'automatic' as const,
    codes: [],
    productSpecific: true,
  };
  const productOffer = {
    ...base,
    id: 'product-a',
    targets: {
      allItems: false,
      productIds: ['gid://shopify/Product/a'],
      variantIds: [],
      collectionIds: [],
    },
  };
  const variantOffer = {
    ...base,
    id: 'variant-b1',
    targets: {
      allItems: false,
      productIds: [],
      variantIds: ['gid://shopify/ProductVariant/b1'],
      collectionIds: [],
    },
  };
  const collectionOffer = {
    ...base,
    id: 'seasonal',
    targets: {
      allItems: false,
      productIds: [],
      variantIds: [],
      collectionIds: ['gid://shopify/Collection/seasonal'],
    },
  };
  const allItemsOffer = {
    ...base,
    id: 'all-items',
    productSpecific: false,
    targets: {
      allItems: true,
      productIds: [],
      variantIds: [],
      collectionIds: [],
    },
  };

  assert.equal(discountProgressAmount(productOffer, items), 600);
  assert.equal(discountProgressAmount(variantOffer, items), 900);
  assert.equal(discountProgressAmount(collectionOffer, items), 1_800);
  assert.equal(discountProgressAmount(allItemsOffer, items), 2_700);
  assert.equal(isDiscountProgressEligible(productOffer, items), true);
  assert.equal(
    discountProgressAmount(
      {
        ...productOffer,
        targets: {
          ...productOffer.targets,
          collectionIds: ['gid://shopify/Collection/seasonal'],
        },
      },
      items,
    ),
    1_800,
    'an item matching two target selectors is counted once',
  );
});

test('discount progress handles exact thresholds, invalid amounts, currencies, and unavailable data safely', () => {
  const milestone = {
    id: 'selected-products',
    threshold: 1_499,
    currencyCode: 'INR' as const,
    reward: '15% off',
    title: 'Selected products',
    method: 'automatic' as const,
    codes: [],
    productSpecific: true,
    targets: {
      allItems: false,
      productIds: ['gid://shopify/Product/eligible'],
      variantIds: [],
      collectionIds: [],
    },
  };
  const items = [
    {
      productId: 'gid://shopify/Product/eligible',
      variantId: 'gid://shopify/ProductVariant/1',
      collectionIds: [],
      amount: 1_499,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/eligible',
      variantId: 'gid://shopify/ProductVariant/2',
      collectionIds: [],
      amount: Number.NaN,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/eligible',
      variantId: 'gid://shopify/ProductVariant/3',
      collectionIds: [],
      amount: -10,
      currencyCode: 'INR' as const,
    },
    {
      productId: 'gid://shopify/Product/eligible',
      variantId: 'gid://shopify/ProductVariant/4',
      collectionIds: [],
      amount: 500,
      currencyCode: 'USD' as const,
    },
  ];

  assert.equal(discountProgressAmount(milestone, items), 1_499);
  const reached = renderToStaticMarkup(
    createElement(DiscountProgress, {
      surface: 'cart',
      status: 'ready',
      items,
      milestones: [milestone],
    }),
  );
  assert.match(reached, /<span>Conditions met<\/span>/);
  assert.match(reached, /aria-valuenow="1499"/);
  assert.equal(
    renderToStaticMarkup(
      createElement(DiscountProgress, {
        surface: 'cart',
        status: 'unavailable',
        items,
        milestones: [milestone],
      }),
    ),
    '',
  );
  assert.match(
    renderToStaticMarkup(
      createElement(DiscountProgress, {
        surface: 'product',
        status: 'ready',
        items,
        eligibilityItems: [items[0]],
        milestones: [{...milestone, productSpecific: false}],
      }),
    ),
    /15% off<\/b> unlocked/,
    'eligible order-wide offers are shown on the product page',
  );
});

test('product progress uses cart totals but hides offers for an ineligible PDP product', () => {
  const milestone = {
    id: 'selected-products',
    threshold: 1_500,
    currencyCode: 'INR' as const,
    reward: '10% off',
    title: '10% off selected teas',
    method: 'automatic' as const,
    codes: [],
    productSpecific: true,
    targets: {
      allItems: false,
      productIds: [],
      variantIds: [],
      collectionIds: ['gid://shopify/Collection/eligible'],
    },
  };
  const cartItems = [
    {
      productId: 'gid://shopify/Product/in-cart',
      variantId: 'gid://shopify/ProductVariant/in-cart',
      collectionIds: ['gid://shopify/Collection/eligible'],
      amount: 1_620,
      currencyCode: 'INR' as const,
    },
  ];
  const eligibleProduct = {
    productId: 'gid://shopify/Product/pdp-eligible',
    variantId: 'gid://shopify/ProductVariant/pdp-eligible',
    collectionIds: ['gid://shopify/Collection/eligible'],
    amount: 475,
    currencyCode: 'INR' as const,
  };
  const ineligibleProduct = {
    ...eligibleProduct,
    productId: 'gid://shopify/Product/pdp-ineligible',
    variantId: 'gid://shopify/ProductVariant/pdp-ineligible',
    collectionIds: [],
  };

  const eligibleHtml = renderToStaticMarkup(
    createElement(DiscountProgress, {
      surface: 'product',
      status: 'ready',
      items: cartItems,
      eligibilityItems: [eligibleProduct],
      milestones: [milestone],
    }),
  );
  assert.match(eligibleHtml, /10% off<\/b> unlocked/);
  assert.doesNotMatch(eligibleHtml, /1,025\.00/);

  assert.equal(
    renderToStaticMarkup(
      createElement(DiscountProgress, {
        surface: 'product',
        status: 'ready',
        items: cartItems,
        eligibilityItems: [ineligibleProduct],
        milestones: [milestone],
      }),
    ),
    '',
  );
});
