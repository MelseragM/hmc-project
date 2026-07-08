/**
 * Sanaad date helpers. The Oracle layer uses display strings like `18-Jun-2019`
 * and `January 2024`, plus tokens like `19000101` / `20200202`.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `19000101` (yyyymmdd token) — used as an "all dates" effective-date default. */
export const EFFECTIVE_DATE_ALL = '19000101';

/** Validate a `yyyymmdd` token like `20200202`. */
export function isDateToken(value: string): boolean {
  return /^\d{8}$/.test(value);
}

/** Validate a `"Month YYYY"` pay period like `January 2024`. */
export function isPayPeriod(value: string): boolean {
  const [month, year] = value.split(' ');
  return MONTHS.includes(month) && /^\d{4}$/.test(year ?? '');
}

/** Parse a `dd-Mon-yyyy` display date (e.g. `18-Jun-2019`) to a Date, or undefined. */
export function parseDisplayDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
