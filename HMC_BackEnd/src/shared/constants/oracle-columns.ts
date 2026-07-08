/**
 * Best-effort key-column assumptions for employee/username-scoped view reads.
 *
 * TODO(verify): the mapping exposes query params (`enum`, `username`, `personid`)
 * but not the underlying view column names. Confirm these against the real
 * XXHMC_SND_* view definitions and adjust in ONE place here.
 */
export const EMP_KEY_COLUMN = 'employee_number';
export const USERNAME_COLUMN = 'username';
export const PERSON_ID_COLUMN = 'person_id';
export const ASSIGNMENT_ID_COLUMN = 'assignment_id';
