export type AdminMetafieldDefinition = {
  key: string;
  label: string;
  type: string;
  group: 'Taste profile' | 'Editorial' | 'Tea record';
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
  {key: 'process', label: 'Process', type: 'single_line_text_field', group: 'Editorial'},
  {
    key: 'tea_style',
    label: 'Tea style',
    type: 'single_line_text_field',
    group: 'Editorial',
  },
  {
    key: 'lot_number',
    label: 'Lot number',
    type: 'single_line_text_field',
    group: 'Editorial',
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
  {key: 'origin', label: 'Origin', type: 'single_line_text_field', group: 'Tea record'},
  {key: 'estate', label: 'Estate', type: 'single_line_text_field', group: 'Tea record'},
  {
    key: 'cultivar',
    label: 'Cultivar',
    type: 'single_line_text_field',
    group: 'Tea record',
  },
  {key: 'grade', label: 'Grade', type: 'single_line_text_field', group: 'Tea record'},
  {key: 'harvest', label: 'Harvest', type: 'single_line_text_field', group: 'Tea record'},
  {key: 'flush', label: 'Flush', type: 'single_line_text_field', group: 'Tea record'},
  {key: 'pluck_date', label: 'Pluck date', type: 'date', group: 'Tea record'},
  {
    key: 'ingredients',
    label: 'Ingredients',
    type: 'list.single_line_text_field',
    group: 'Tea record',
    multiline: true,
  },
  {key: 'net_weight', label: 'Net weight', type: 'weight', group: 'Tea record'},
] as const;

export const ADMIN_METAFIELD_BY_KEY = new Map(
  ADMIN_METAFIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

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
      if (type.startsWith('list.') && !Array.isArray(parsed))
        return 'Enter a JSON array.';
      if (
        type === 'weight' &&
        (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      ) {
        return 'Enter a JSON object with value and unit.';
      }
    } catch {
      return 'Enter valid JSON.';
    }
  }
  return null;
}
