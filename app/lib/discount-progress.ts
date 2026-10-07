export type DiscountProgressMilestone = {
  id: string;
  threshold: number;
  currencyCode: string;
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
