export const TEA_SENSORY_METAFIELD = {
  namespace: 'custom',
  key: 'tea_sensory_profile',
} as const;

export const SENSORY_VALUES = {
  moods: ['fresh', 'calm', 'focused', 'comfort', 'energised', 'curious'],
  flavours: ['floral', 'grassy', 'malty', 'roasted', 'brisk'],
  intensities: ['light', 'balanced', 'bold'],
  styles: ['hot', 'iced', 'whisked'],
} as const;

export type SensoryAnswers = {
  mood: string;
  flavour: string;
  intensity: string;
  style: string;
};

export type SensoryTea = {
  id: string;
  title: string;
  handle: string;
  productType: string;
  vendor: string;
  image: {url: string; altText: string | null; width?: number; height?: number} | null;
  price: {amount: string; currencyCode: string};
  availableForSale: boolean;
  profile: {
    schemaVersion: number;
    flavours: string[];
    moods: string[];
    intensities: string[];
    styles: string[];
    tastingSummary: string;
    origin: string;
    estate: string;
    brew: {temperatureC: number | null; seconds: number | null; ratio: string};
  };
};

export type StorefrontSensoryProduct = Omit<SensoryTea, 'profile' | 'price'> & {
  priceRange: {minVariantPrice: SensoryTea['price']};
  sensoryProfile?: {type?: string; value?: string} | null;
};

const strings = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter(Boolean))]
    : [];

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseSensoryTea(product: StorefrontSensoryProduct): SensoryTea | null {
  const metafield = product.sensoryProfile;
  if (!metafield?.value || (metafield.type && metafield.type !== 'json')) return null;

  try {
    const value = JSON.parse(metafield.value) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || value.enabled === false) return null;
    const brew = value.brew && typeof value.brew === 'object'
      ? (value.brew as Record<string, unknown>)
      : {};
    const flavours = strings(value.flavours);
    const intensities = strings(value.intensities ?? value.intensity);
    const styles = strings(value.styles);
    if (!flavours.length || !intensities.length || !styles.length) return null;

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      productType: product.productType,
      vendor: product.vendor,
      image: product.image,
      price: product.priceRange.minVariantPrice,
      availableForSale: product.availableForSale,
      profile: {
        schemaVersion: finiteNumber(value.schemaVersion) ?? 1,
        flavours,
        moods: strings(value.moods),
        intensities,
        styles,
        tastingSummary: text(value.tastingSummary),
        origin: text(value.origin),
        estate: text(value.estate),
        brew: {
          temperatureC: finiteNumber(brew.temperatureC),
          seconds: finiteNumber(brew.seconds),
          ratio: text(brew.ratio),
        },
      },
    };
  } catch {
    return null;
  }
}

const MOOD_FLAVOURS: Record<string, string[]> = {
  fresh: ['grassy', 'floral', 'brisk'],
  calm: ['floral', 'grassy'],
  focused: ['grassy', 'brisk'],
  comfort: ['malty', 'roasted'],
  energised: ['brisk', 'malty'],
  curious: ['roasted', 'floral', 'grassy'],
};

export function scoreSensoryTea(tea: SensoryTea, answers: SensoryAnswers) {
  let score = 0;
  const reasons: string[] = [];

  if (answers.flavour === 'surprise') score += 1;
  else if (tea.profile.flavours.includes(answers.flavour)) {
    score += 5;
    reasons.push(`${answers.flavour} character`);
  }
  if (tea.profile.intensities.includes(answers.intensity)) {
    score += 3;
    reasons.push(`${answers.intensity} body`);
  }
  if (tea.profile.styles.includes(answers.style)) {
    score += 3;
    reasons.push(`${answers.style} preparation`);
  }
  if (tea.profile.moods.includes(answers.mood)) {
    score += 3;
    reasons.push(`${answers.mood} mood`);
  } else if ((MOOD_FLAVOURS[answers.mood] ?? []).some((flavour) => tea.profile.flavours.includes(flavour))) {
    score += 2;
  }
  if (tea.availableForSale) score += 0.25;

  return {score, reasons};
}

export function rankSensoryTeas(teas: SensoryTea[], answers: SensoryAnswers) {
  return teas
    .map((tea) => ({tea, ...scoreSensoryTea(tea, answers)}))
    .sort((left, right) => right.score - left.score || left.tea.title.localeCompare(right.tea.title));
}
