export const DEFAULT_PRODUCT_ORIGIN_LABEL = 'Assam / 26.98° N';

const PRODUCT_ORIGIN_TAG_PREFIX = 'origin-label:';

export function getProductOriginLabel(tags?: readonly string[] | null) {
  const originTag = tags?.find((tag) =>
    tag.trimStart().toLowerCase().startsWith(PRODUCT_ORIGIN_TAG_PREFIX),
  );
  const label = originTag
    ?.trim()
    .slice(PRODUCT_ORIGIN_TAG_PREFIX.length)
    .trim();

  return label || DEFAULT_PRODUCT_ORIGIN_LABEL;
}
