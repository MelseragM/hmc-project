import { isPlainObject } from './localize.util';

/**
 * Collapses runs of two or more spaces into one and trims the string values of
 * a response payload (recursing through arrays and plain objects).
 *
 * WORKLISTS_V composes display strings from CHAR-padded columns, so the
 * notification endpoints answered `"037400    - Amir Ibrahim"` in FROM_USER/
 * TO_USER and inside SUBJECT. Only the space character is collapsed — tabs and
 * newlines (e.g. in comment bodies) are left untouched.
 */
export function collapseSpaceRuns<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/ {2,}/g, ' ').trim() as unknown as T;
  if (Array.isArray(value)) return value.map((v) => collapseSpaceRuns(v)) as unknown as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) out[key] = collapseSpaceRuns(val);
  return out as T;
}
