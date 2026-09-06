export type TeaIngredient = {
  productId?: string;
  variantId: string;
  title: string;
  teaType?: string;
  origin?: string;
  grams: number;
  pricePerGram: number;
  maxContributionGrams: number;
  minContributionGrams?: number;
  availableForSale?: boolean;
  quantityAvailable?: number | null;
  eligible: boolean;
};

export type BlendRules = {minGrams: number; maxGrams: number; maxItems: number; incrementGrams: number; packagingPrice: number};
export const defaultBlendRules: BlendRules = {minGrams: 25, maxGrams: 200, maxItems: 10, incrementGrams: 5, packagingPrice: 0};
export type BlendValidation = {valid: boolean; errors: string[]; totalGrams: number};

export function calculateTotalGrams(items: Pick<TeaIngredient, 'grams'>[]) {
  return items.reduce((total, item) => total + item.grams, 0);
}

export function validateIncrement(grams: number, incrementGrams: number) {
  return Number.isInteger(grams / incrementGrams);
}

export function validateTotalWeight(totalGrams: number, rules = defaultBlendRules) {
  if (totalGrams < rules.minGrams) return `Choose at least ${rules.minGrams}g.`;
  if (totalGrams > rules.maxGrams) return `Choose no more than ${rules.maxGrams}g.`;
  return null;
}

export function validateMaximumUniqueItems(items: Pick<TeaIngredient, 'variantId'>[], rules = defaultBlendRules) {
  if (items.length < 1) return 'Choose at least one tea.';
  if (items.length > rules.maxItems) return `Choose no more than ${rules.maxItems} teas.`;
  if (new Set(items.map((item) => item.variantId)).size !== items.length) return 'Each tea can be added only once.';
  return null;
}

export function validateItemWeight(item: TeaIngredient, rules = defaultBlendRules) {
  const errors: string[] = [];
  const minContributionGrams = item.minContributionGrams ?? rules.incrementGrams;

  if (item.grams <= 0) errors.push(`${item.title} must be at least ${minContributionGrams}g.`);
  if (!validateIncrement(item.grams, rules.incrementGrams)) errors.push(`${item.title} must use ${rules.incrementGrams}g increments.`);
  if (item.grams < minContributionGrams) errors.push(`${item.title} must be at least ${minContributionGrams}g.`);
  if (item.grams > item.maxContributionGrams) errors.push(`${item.title} is limited to ${item.maxContributionGrams}g.`);

  return errors;
}

export function decimalToMinorUnits(amount: number | string, scale = 100) {
  const value = String(amount);
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`Invalid money amount: ${value}`);
  const [major, minor = ''] = value.split('.');
  const paddedMinor = minor.padEnd(String(scale).length - 1, '0').slice(0, String(scale).length - 1);
  const remainder = minor.slice(String(scale).length - 1);
  const base = Number(major) * scale + Number(paddedMinor || '0');
  return remainder && Number(remainder[0]) >= 5 ? base + 1 : base;
}

export function minorUnitsToDecimal(amount: number, scale = 100) {
  return amount / scale;
}

export function calculateIngredientPriceCents(item: Pick<TeaIngredient, 'grams' | 'pricePerGram'>) {
  return item.grams * decimalToMinorUnits(item.pricePerGram);
}

export function calculateBoxSubtotalCents(items: TeaIngredient[]) {
  return items.reduce((sum, item) => sum + calculateIngredientPriceCents(item), 0);
}

export function calculateBoxTotalCents(items: TeaIngredient[], rules = defaultBlendRules) {
  return calculateBoxSubtotalCents(items) + decimalToMinorUnits(rules.packagingPrice);
}

export function validateBlend(items: TeaIngredient[], rules = defaultBlendRules): BlendValidation {
  const errors: string[] = [];
  const totalGrams = calculateTotalGrams(items);
  const itemCountError = validateMaximumUniqueItems(items, rules);
  const totalWeightError = validateTotalWeight(totalGrams, rules);
  if (itemCountError) errors.push(itemCountError);
  if (totalWeightError) errors.push(totalWeightError);

  for (const item of items) {
    if (!item.eligible) errors.push(`${item.title} is not available for blending.`);
    if (item.availableForSale === false) errors.push(`${item.title} is unavailable.`);
    if (item.quantityAvailable != null && item.quantityAvailable < item.grams) errors.push(`${item.title} has only ${item.quantityAvailable}g available.`);
    errors.push(...validateItemWeight(item, rules));
    if (item.pricePerGram < 0 || !Number.isFinite(item.pricePerGram)) errors.push(`${item.title} has an invalid price.`);
  }
  return {valid: errors.length === 0, errors, totalGrams};
}

export function priceBlend(items: TeaIngredient[], rules = defaultBlendRules): number {
  return minorUnitsToDecimal(calculateBoxTotalCents(items, rules));
}

export function inventoryChanges(items: TeaIngredient[]) {
  return items.map((item) => ({variantId: item.variantId, delta: -item.grams}));
}

export function serialiseBlend(items: TeaIngredient[], rules: BlendRules) {
  return JSON.stringify({version: 1, items, totalGrams: calculateTotalGrams(items), price: priceBlend(items, rules)});
}
