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
}
