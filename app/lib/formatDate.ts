const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// IST is UTC+5:30 with no daylight-saving shifts — a fixed offset we can
// add ourselves without relying on Intl or the host environment's timezone.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Decompose a UTC date string into the IST calendar date (day/month/year).
 * Returns null when the value cannot be parsed as a date.
 */
function istCalendarDate(value: string): {day: number; month: number; year: number} | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Shift the timestamp by the IST offset and read the "UTC" fields of the
  // resulting Date — this gives us the IST wall-clock date with no reliance
  // on Intl, the host timezone, or ICU data.
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {day: ist.getUTCDate(), month: ist.getUTCMonth(), year: ist.getUTCFullYear()};
}

/**
 * Format a date string as "D Month YYYY" (e.g. "19 September 2026") in IST.
 * Produces identical output on the server and the browser regardless of
 * Node.js ICU build or browser locale configuration.
 */
export function formatDateLong(value: string): string {
  const d = istCalendarDate(value);
  if (!d) return '';
  return `${d.day} ${MONTHS_LONG[d.month]} ${d.year}`;
}

/**
 * Format a date string as "Mon YYYY" (e.g. "Sep 2026") in IST.
 * Produces identical output on the server and the browser regardless of
 * Node.js ICU build or browser locale configuration.
 */
export function formatDateShort(value: string): string {
  const d = istCalendarDate(value);
  if (!d) return '';
  return `${MONTHS_SHORT[d.month]} ${d.year}`;
}

/**
 * Format a date string as "Month D, YYYY" (e.g. "September 19, 2026") in IST.
 * Produces identical output on the server and the browser regardless of
 * Node.js ICU build or browser locale configuration.
 */
export function formatDateLongUS(value: string): string {
  const d = istCalendarDate(value);
  if (!d) return '';
  return `${MONTHS_LONG[d.month]} ${d.day}, ${d.year}`;
}
