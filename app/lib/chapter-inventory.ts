type StockStatus = {availableForSale: boolean; currentlyNotInStock: boolean};

/** Ignore backorders: they are purchasable despite having no stock on hand. */
export function selectStockedChapterProduct<T extends {variants: {nodes: StockStatus[]}}>(
  products: T[],
): T | null {
  return products.find((product) =>
    product.variants.nodes.some((variant) =>
      variant.availableForSale && !variant.currentlyNotInStock,
    ),
  ) ?? null;
}

export function findChapterCollection<T extends {title: string}>(
  collections: T[],
  title: string,
): T | null {
  return collections.find((collection) =>
    collection.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
  ) ?? null;
}
