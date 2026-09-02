export type TeaIngredient = {
  variantId: string;
  title: string;
  grams: number;
  pricePerGram: number;
  maxContributionGrams: number;
  eligible: boolean;
};

export type BlendRules = {minGrams: number; maxGrams: number; maxItems: number; incrementGrams: number; packagingPrice: number};
export const defaultBlendRules: BlendRules = {minGrams: 50, maxGrams: 200, maxItems: 10, incrementGrams: 5, packagingPrice: 0};
export type BlendValidation = {valid: boolean; errors: string[]; totalGrams: number};

export function validateBlend(items: TeaIngredient[], rules = defaultBlendRules): BlendValidation {
  const errors: string[] = [];
  const totalGrams = items.reduce((total, item) => total + item.grams, 0);
  if (items.length < 1) errors.push('Choose at least one tea.');
  if (items.length > rules.maxItems) errors.push(`Choose no more than ${rules.maxItems} teas.`);
  if (new Set(items.map((item) => item.variantId)).size !== items.length) errors.push('Each tea can be added only once.');
  if (totalGrams < rules.minGrams) errors.push(`Choose at least ${rules.minGrams}g.`);
  if (totalGrams > rules.maxGrams) errors.push(`Choose no more than ${rules.maxGrams}g.`);
  for (const item of items) {
    if (!item.eligible) errors.push(`${item.title} is not available for blending.`);
    if (!Number.isInteger(item.grams / rules.incrementGrams)) errors.push(`${item.title} must use ${rules.incrementGrams}g increments.`);
    if (item.grams <= 0) errors.push(`${item.title} must be at least ${rules.incrementGrams}g.`);
    if (item.grams > item.maxContributionGrams) errors.push(`${item.title} is limited to ${item.maxContributionGrams}g.`);
    if (item.pricePerGram < 0 || !Number.isFinite(item.pricePerGram)) errors.push(`${item.title} has an invalid price.`);
  }
  return {valid: errors.length === 0, errors, totalGrams};
}

export function priceBlend(items: TeaIngredient[], rules = defaultBlendRules): number {
  return Math.round((items.reduce((sum, item) => sum + item.grams * item.pricePerGram, 0) + rules.packagingPrice) * 100) / 100;
}

export function inventoryChanges(items: TeaIngredient[]) {
  return items.map((item) => ({variantId: item.variantId, delta: -item.grams}));
}

export function serialiseBlend(items: TeaIngredient[], rules: BlendRules) {
  return JSON.stringify({version: 1, items, totalGrams: items.reduce((n, i) => n + i.grams, 0), price: priceBlend(items, rules)});
}
