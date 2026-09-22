export type ReserveProduct = {
  title: string;
  handle: string;
  variants: {nodes: {quantityAvailable: number | null}[]};
};

export type ReserveCollection = {
  title: string;
  handle: string;
  description: string;
  products: ReserveProduct[];
};

const ROMAN_VALUES: Record<string, number> = {I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000};

function chapterNumber(title: string): number | null {
  const match = /^chapter\s+([IVXLCDM]+|\d+)$/i.exec(title.trim());
  if (!match) return null;
  if (/^\d+$/.test(match[1])) return Number(match[1]);
  const roman = match[1].toUpperCase();
  return [...roman].reduce((total, character, index) => {
    const value = ROMAN_VALUES[character];
    return total + (value < (ROMAN_VALUES[roman[index + 1]] ?? 0) ? -value : value);
  }, 0);
}

export function partitionReserveCollections(collections: ReserveCollection[]) {
  const chapters = collections
    .filter((collection) => chapterNumber(collection.title) !== null)
    .sort((a, b) => chapterNumber(a.title)! - chapterNumber(b.title)!);
  const others = collections.filter((collection) => chapterNumber(collection.title) === null);
  return {chapters, others};
}

export function hasInventory(product: ReserveProduct): boolean {
  return product.variants.nodes.some((variant) => (variant.quantityAvailable ?? 0) > 0);
}

export function chapterState(collection: ReserveCollection): 'open' | 'coming-soon' | 'locked' {
  if (collection.products.some(hasInventory)) return 'open';
  return collection.products.length ? 'coming-soon' : 'locked';
}
