import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

type CurrencyCode = MoneyV2['currencyCode'];

export type DiscountProgressMilestone = {
  id: string;
  threshold: number;
  currencyCode: CurrencyCode;
  reward: string;
  title: string;
  method: 'automatic' | 'code';
  codes: string[];
};

export type DiscountProgressStatus =
  | 'ready'
  | 'not-configured'
  | 'permission-required'
  | 'unavailable';

export type DiscountProgressData = {
  status: DiscountProgressStatus;
  milestones: DiscountProgressMilestone[];
};
