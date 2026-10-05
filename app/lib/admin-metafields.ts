export type AdminMetafieldDefinition = {
  key: string;
  label: string;
  type: string;
  group: 'Taste profile' | 'Editorial' | 'Traceability';
  multiline?: boolean;
  min?: number;
  max?: number;
};

export const ADMIN_METAFIELD_DEFINITIONS: readonly AdminMetafieldDefinition[] = [
  {
    key: 'roast',
    label: 'Roast',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'body',
    label: 'Body',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'sweetness',
    label: 'Sweetness',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'astringency',
    label: 'Astringency',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'caffeine_score',
    label: 'Caffeine score',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'bitterness',
    label: 'Bitterness',
    type: 'number_integer',
    group: 'Taste profile',
    min: 1,
    max: 5,
  },
  {
    key: 'best_time',
    label: 'Best time',
    type: 'single_line_text_field',
    group: 'Editorial',
  },
  {
    key: 'milk_pairing',
    label: 'Milk pairing',
    type: 'single_line_text_field',
    group: 'Editorial',
  },
  {
    key: 'tasting_notes',
    label: 'Tasting notes',
    type: 'list.single_line_text_field',
    group: 'Editorial',
  },
  {
    key: 'character_summary',
    label: 'Character summary',
    type: 'multi_line_text_field',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'recipe_hot',
    label: 'Hot recipe',
    type: 'json',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'recipe_iced',
    label: 'Iced recipe',
    type: 'json',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'recipe_latte',
    label: 'Latte recipe',
    type: 'json',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'process',
    label: 'Process',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'tea_style',
    label: 'Tea type',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'lot_number',
    label: 'Lot',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'is_this_tea_yes',
    label: 'You will love this tea if',
    type: 'list.single_line_text_field',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'is_this_tea_no',
    label: 'This tea may not suit you if',
    type: 'list.single_line_text_field',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'why_choose_tea',
    label: 'Why we chose this tea',
    type: 'multi_line_text_field',
    group: 'Editorial',
    multiline: true,
  },
  {
    key: 'why_choose_attribution',
    label: 'Quote attribution',
    type: 'single_line_text_field',
    group: 'Editorial',
  },
  {
    key: 'origin',
    label: 'Origin',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'estate',
    label: 'Estate',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'cultivar',
    label: 'Cultivar',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'grade',
    label: 'Grade',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'harvest',
    label: 'Harvest',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'flush',
    label: 'Flush',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {key: 'pluck_date', label: 'Pluck date', type: 'date', group: 'Traceability'},
  {
    key: 'ingredients',
    label: 'Ingredients',
    type: 'list.single_line_text_field',
    group: 'Traceability',
    multiline: true,
  },
  {
    key: 'caffeine_level',
    label: 'Caffeine level',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'brewing_suggestion',
    label: 'Preparation',
    type: 'multi_line_text_field',
    group: 'Traceability',
    multiline: true,
  },
  {
    key: 'storage',
    label: 'Storage',
    type: 'multi_line_text_field',
    group: 'Traceability',
    multiline: true,
  },
  {
    key: 'shelf_life',
    label: 'Shelf life',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'allergens',
    label: 'Allergens',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {
    key: 'certifications',
    label: 'Certifications',
    type: 'single_line_text_field',
    group: 'Traceability',
  },
  {key: 'net_weight', label: 'Pack size', type: 'weight', group: 'Traceability'},
] as const;

export const ADMIN_NATIVE_TRACEABILITY_FIELDS = [
  {
    namespace: 'shopify',
    key: 'tea-input-type',
    label: 'Tea format',
    attributeName: 'Tea input type',
    type: 'list.metaobject_reference',
    group: 'Traceability' as const,
    multiline: true,
  },
  {
    namespace: 'shopify',
    key: 'taste-profile',
    label: 'Taxonomy taste profile',
    attributeName: 'Taste profile',
    type: 'list.metaobject_reference',
    group: 'Traceability' as const,
    multiline: true,
  },
] as const;

type TaxonomyDefinitionConstraints = null | {
  values: {nodes: Array<{value: string}>};
};

function taxonomySubtype(value: string) {
  return value.replace(/^gid:\/\/shopify\/TaxonomyCategory\//, '');
}

export function isTaxonomyDefinitionApplicable(
  constraints: TaxonomyDefinitionConstraints,
  categoryId: string | null | undefined,
  ancestorIds: readonly string[] = [],
) {
  if (!categoryId) return false;
  if (!constraints || constraints.values.nodes.length === 0) return true;
  const productCategories = new Set(
    [categoryId, ...ancestorIds].map(taxonomySubtype),
  );
  return constraints.values.nodes.some(({value}) =>
    productCategories.has(taxonomySubtype(value)),
  );
}

export const ADMIN_METAFIELD_BY_KEY = new Map(
  ADMIN_METAFIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export const SHOPIFY_WEIGHT_UNITS = ['GRAMS', 'KILOGRAMS', 'OUNCES', 'POUNDS'] as const;

export function serializeWeightMetafieldValue(amount: string, unit: string) {
  return JSON.stringify({value: Number(amount), unit});
}

export function validateMetafieldValue(type: string, value: string, key: string) {
  if (type === 'number_integer') {
    if (!/^-?\d+$/.test(value)) return 'Enter a whole number.';
    const number = Number(value);
    const definition = ADMIN_METAFIELD_BY_KEY.get(key);
    if (definition?.min !== undefined && number < definition.min) {
      return `Must be at least ${definition.min}.`;
    }
    if (definition?.max !== undefined && number > definition.max) {
      return `Must be no more than ${definition.max}.`;
    }
  }
  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Use YYYY-MM-DD.';
  }
  if (type === 'json' || type === 'weight' || type.startsWith('list.')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (type.startsWith('list.')) {
        if (!Array.isArray(parsed)) return 'Enter a JSON array.';
        if (
          type === 'list.metaobject_reference' &&
          !parsed.every(
            (item) =>
              typeof item === 'string' &&
              /^gid:\/\/shopify\/(?:Metaobject|TaxonomyValue)\/\d+$/.test(item),
          )
        ) {
          return 'Enter a JSON array of Shopify reference GIDs.';
        }
      }
      if (type === 'weight') {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return 'Enter a weight and unit.';
        }
        const weight = parsed as {value?: unknown; unit?: unknown};
        if (
          typeof weight.value !== 'number' ||
          !Number.isFinite(weight.value) ||
          weight.value <= 0
        ) {
          return 'Weight must be greater than zero.';
        }
        if (
          typeof weight.unit !== 'string' ||
          !SHOPIFY_WEIGHT_UNITS.includes(
            weight.unit as (typeof SHOPIFY_WEIGHT_UNITS)[number],
          )
        ) {
          return 'Select a valid weight unit.';
        }
      }
    } catch {
      return 'Enter valid JSON.';
    }
  }
  return null;
}
