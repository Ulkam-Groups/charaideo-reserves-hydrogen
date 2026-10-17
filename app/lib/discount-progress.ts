import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

type CurrencyCode = MoneyV2['currencyCode'];

export type DiscountProgressMilestone = {
  id: string;
  threshold: number;
  currencyCode: CurrencyCode;
  reward: string;
  title: string;
  method: 'automatic' | 'code';
  codes: string[];
  productSpecific: boolean;
  targets: DiscountProgressTargets;
};

export type DiscountProgressItem = {
  productId: string;
  variantId: string;
  collectionIds: string[];
  amount: number;
  currencyCode: CurrencyCode;
};

export type DiscountProgressTargets = {
  allItems: boolean;
  productIds: string[];
  variantIds: string[];
  collectionIds: string[];
};

export function isDiscountProgressEligible(
  milestone: DiscountProgressMilestone,
  items: readonly DiscountProgressItem[],
) {
  return items.some((item) => isItemEligible(milestone.targets, item));
}

export function discountProgressAmount(
  milestone: DiscountProgressMilestone,
  items: readonly DiscountProgressItem[],
) {
  return items.reduce(
    (total, item) =>
      item.currencyCode === milestone.currencyCode &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      isItemEligible(milestone.targets, item)
        ? total + item.amount
        : total,
    0,
  );
}

export function cartDiscountProgressItems(
  cart: Pick<CartApiQueryFragment, 'lines'> | null | undefined,
): DiscountProgressItem[] {
  return (cart?.lines?.nodes ?? []).flatMap((line) => {
    const product = line.merchandise.product;
    const price = line.merchandise.price;
    if (!product?.id || !price?.amount || !price.currencyCode) return [];

    return [{
      productId: product.id,
      variantId: line.merchandise.id,
      collectionIds:
        'collections' in product ? product.collections.nodes.map(({id}) => id) : [],
      amount: Number(price.amount) * line.quantity,
      currencyCode: price.currencyCode,
    }];
  });
}

function isItemEligible(
  targets: DiscountProgressTargets,
  {productId, variantId, collectionIds}: DiscountProgressItem,
) {
  return (
    targets.allItems ||
    targets.productIds.includes(productId) ||
    targets.variantIds.includes(variantId) ||
    collectionIds.some((id) => targets.collectionIds.includes(id))
  );
}

export type DiscountProgressStatus =
  'ready' | 'not-configured' | 'permission-required' | 'unavailable';

export type DiscountProgressData = {
  status: DiscountProgressStatus;
  milestones: DiscountProgressMilestone[];
};
