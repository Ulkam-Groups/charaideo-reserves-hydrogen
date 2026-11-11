import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

type CurrencyCode = MoneyV2['currencyCode'];

export type DiscountCombinationRules = {
  orderDiscounts: boolean;
  productDiscounts: boolean;
  shippingDiscounts: boolean;
};

export type DiscountEligibleItems = {
  kind: 'products' | 'collections';
  labels: string[];
};

export type DiscountProgressMilestone = {
  id: string;
  threshold: number;
  currencyCode: CurrencyCode;
  reward: string;
  title: string;
  method: 'automatic' | 'code';
  codes: string[];
  discountClasses?: string[];
  combinesWith?: DiscountCombinationRules;
  eligibleItems?: DiscountEligibleItems;
  productSpecific: boolean;
  targets: DiscountProgressTargets;
};

export type DiscountCodeCombination = {
  id: string;
  codes: string[];
  discountClasses: string[];
  combinesWith?: DiscountCombinationRules;
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
  return items.some((item) => isDiscountProgressItemEligible(milestone, item));
}

export function isDiscountProgressItemEligible(
  milestone: DiscountProgressMilestone,
  item: DiscountProgressItem,
) {
  return isItemEligible(milestone.targets, item);
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
  codeDiscounts?: DiscountCodeCombination[];
};

export function combinableDiscountMilestones(
  milestones: readonly DiscountProgressMilestone[],
  appliedCodes: readonly string[],
  codeDiscounts: readonly DiscountCodeCombination[],
) {
  const incompatibleIds = new Set(
    incompatibleDiscountMilestoneIds(milestones, appliedCodes, codeDiscounts),
  );
  return milestones.filter(({id}) => !incompatibleIds.has(id));
}

export function incompatibleDiscountMilestoneIds(
  milestones: readonly DiscountProgressMilestone[],
  appliedCodes: readonly string[],
  codeDiscounts: readonly DiscountCodeCombination[],
) {
  if (!appliedCodes.length) return [];

  const applied = appliedCodes.map((code) =>
    codeDiscounts.find((discount) =>
      discount.codes.some((candidate) => candidate.toLowerCase() === code.toLowerCase()),
    ),
  );

  return milestones.flatMap((milestone) =>
    applied.every((discount) => discountsCanCombine(discount, milestone))
      ? []
      : [milestone.id],
  );
}

function discountsCanCombine(
  applied: DiscountCodeCombination | undefined,
  milestone: DiscountProgressMilestone,
) {
  // Never present an offer as applicable when Shopify's rules are unavailable.
  if (!applied) return false;
  if (applied.id === milestone.id) return true;
  if (!applied.discountClasses.length || !milestone.discountClasses?.length) return false;

  return milestone.discountClasses.every(
    (milestoneClass) =>
      combinationAllows(applied.combinesWith, milestoneClass) &&
      applied.discountClasses.every((appliedClass) =>
        combinationAllows(milestone.combinesWith, appliedClass),
      ),
  );
}

function combinationAllows(
  rules: DiscountCombinationRules | undefined,
  discountClass: string,
) {
  if (discountClass === 'ORDER') return rules?.orderDiscounts === true;
  if (discountClass === 'PRODUCT') return rules?.productDiscounts === true;
  if (discountClass === 'SHIPPING') return rules?.shippingDiscounts === true;
  return false;
}
