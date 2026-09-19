const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a date string as "D Month YYYY" (e.g. "19 September 2026").
 * Uses UTC components so output is identical on the server and browser,
 * regardless of ICU data version or locale configuration.
 */
export function formatDateLong(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Format a date string as "Mon YYYY" (e.g. "Sep 2026").
 * Uses UTC components so output is identical on the server and browser,
 * regardless of ICU data version or locale configuration.
 */
export function formatDateShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Format a date string as "Month D, YYYY" (e.g. "September 19, 2026").
 * Matches the visual output of Intl.DateTimeFormat('en-US', {year:'numeric',month:'long',day:'numeric'})
 * but uses UTC components so output is identical on the server and browser,
 * regardless of ICU data version or locale configuration.
 */
export function formatDateLongUS(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
