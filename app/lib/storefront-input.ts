import type {CartLineInput} from '@shopify/hydrogen/storefront-api-types';

const MAX_CART_LINES = 25;
const MAX_LINE_QUANTITY = 100;
const MAX_SEARCH_TERM_LENGTH = 100;
const MAX_PREDICTIVE_RESULTS = 20;

export function parseCartPermalink(linesValue: string, discountValue: string | null) {
  if (!linesValue || linesValue.length > 2_048) {
    throw new Error('Invalid cart link.');
  }

  const encodedLines = linesValue.split(',');
  if (!encodedLines.length || encodedLines.length > MAX_CART_LINES) {
    throw new Error('Invalid cart link.');
  }

  const lines: CartLineInput[] = encodedLines.map((encodedLine) => {
    const match = /^(\d{1,30}):(\d{1,3})$/.exec(encodedLine);
    if (!match) throw new Error('Invalid cart link.');

    const quantity = Number(match[2]);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new Error('Invalid cart quantity.');
    }

    return {
      merchandiseId: `gid://shopify/ProductVariant/${match[1]}`,
      quantity,
    };
  });

  const discount = discountValue?.trim();
  if (
    discount &&
    (discount.length > 100 || !/^[\p{L}\p{N} _-]+$/u.test(discount))
  ) {
    throw new Error('Invalid discount code.');
  }

  return {lines, discountCodes: discount ? [discount] : []};
}

export function normalizePredictiveSearch(rawTerm: string | null, rawLimit: string | null) {
  const term = String(rawTerm ?? '').trim().slice(0, MAX_SEARCH_TERM_LENGTH);
  const parsedLimit = Number(rawLimit ?? 10);
  const limit = Number.isSafeInteger(parsedLimit)
    ? Math.min(MAX_PREDICTIVE_RESULTS, Math.max(1, parsedLimit))
    : 10;

  return {term, limit};
}
