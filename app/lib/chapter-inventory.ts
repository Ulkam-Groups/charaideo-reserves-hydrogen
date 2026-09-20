/** A chapter opens only when at least one product in its collection has stock. */
export function selectStockedChapterProduct<T extends {totalInventory: number | null}>(
  products: T[],
): T | null {
  return products.find((product) => (product.totalInventory ?? 0) > 0) ?? null;
}

export function findChapterCollection<T extends {title: string}>(
  collections: T[],
  title: string,
): T | null {
  return collections.find((collection) =>
    collection.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
  ) ?? null;
}
