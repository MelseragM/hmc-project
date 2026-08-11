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

/**
 * Parse a `yyyymmdd` token (e.g. `20240911`) to a local midnight `Date`, or
 * undefined. Binding it as a raw string to a DATE-typed procedure argument
 * lets node-oracledb fall back to an implicit, NLS-dependent conversion that
 * rejects `yyyymmdd` (`ORA-01861: literal does not match format string`).
 */
export function parseDateToken(value: string): Date | undefined {
  if (!isDateToken(value)) return undefined;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
