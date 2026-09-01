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
  /**
   * The row's own record id, when the view carries one and a submit needs it.
   *
   * Only the return-from-leave LOVs have this today: RET_FRM_LEAV_PR runs
   * TO_NUMBER on `p_leave_details`, so op 56 binds ABSENCE_ATTENDANCE_ID and
   * every text form answers ORA-01722. It is a SEPARATE field rather than a
   * different `used_value` so existing clients see no change — `used_value`
   * stays the English label everywhere, and only the callers that need the id
   * read it.
   */
  id?: string;
}
