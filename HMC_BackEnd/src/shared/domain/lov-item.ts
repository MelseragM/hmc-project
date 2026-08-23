/**
 * A single list-of-values entry. Oracle LOV/view rows expose paired
 * columns (`meaning` / `meaning_ar`); the Arabic value is URL-encoded on
 * the wire and decoded by the infrastructure mapper (Anticorruption Layer).
 * Framework-free — safe to import from the domain layer.
 */
export interface LovItem {
  code: string;
  meaning: string;
  meaningAr?: string;
  /**
   * The ENGLISH meaning, always — regardless of the request's `lang`. The
   * localization interceptor swaps `meaning` for its Arabic twin on `lang=ar`,
   * but Oracle submit procedures expect the English value, so clients bind
   * this field back on submits. Present on every LOV item.
   */
  used_value: string;
  /**
   * Grouping key of the multi-type LOVs — DEP_LOOKUP_LOV returns address types,
   * relationships, genders and sponsorship kinds in one result set, told apart by
   * its `DATATYPE` column.
   */
  type?: string;
}
