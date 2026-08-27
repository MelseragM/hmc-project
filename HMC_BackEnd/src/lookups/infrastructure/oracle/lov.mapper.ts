import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { col, str, strAr } from '@shared/utils/mapper.util';

/**
 * Maps a generic Oracle LOV/view row to a LovItem. The `XXHMC_SND_*` LOVs expose
 * several unrelated column vocabularies, all documented in the Sanaad mapping:
 *
 *  - `CODE` / `VALUE` / `VALUEAR`                          — COUNTRY_LOV
 *  - `FLEX_VALUE_ID` / `FLEX_VALUE` / `FLEX_VALUE_MEANING` — value-set LOVs
 *    (EDU_STAGE_LOV, SCH_TERM_LOV, PASSPORT_TYPE, ...)
 *  - `CODE` / `DATA` / `DATAAR` / `DATATYPE`               — DEP_LOOKUP_LOV
 *  - `PLACE`, `NAME`, `CONTRACT_YEAR`, `DEFAULT_VALUE`     — single-column LOVs
 *  - `MEANING` / `MEANING_AR`                              — plain lookup LOVs
 *
 * Probing only `meaning`-style names meant the label was never found for the
 * value-set and country LOVs, and the "first non-null column" fallback then
 * returned the surrogate id — hence responses such as `{"code":"AD",
 * "meaning":"AD"}` and `{"code":"315540","meaning":"315540"}`. Labels are now
 * probed with the documented vocabularies first, and the generic fallback skips
 * the code column and the technical columns (ids, username, grouping type).
 * Arabic values are URL-decoded here (Anticorruption Layer).
 */
export class LovMapper {
  private static readonly CODE_COLUMNS = [
    'code',
    'lookup_code',
    'flex_value',
    'flexvalue',
    'flex_value_id',
    'flexvalueid',
    'meaning_code',
    'establishment_id',
    'establishmentid',
  ];

  private static readonly MEANING_COLUMNS = [
    'meaning',
    'flex_value_meaning',
    'flexvaluemeaning',
    // ABSENCE_REASON_V pairs LEAVE_REASON/LEAVE_REASON_AR with a LEAVE_TYPE
    // grouping column — the reason is the label, never the type.
    'leave_reason',
    'description',
    'display_value',
    'value',
    'data',
    'place',
    'contract_year',
    'contractyear',
    'default_value',
    'defaultvalue',
    'name',
    'meaning_en',
  ];

  private static readonly MEANING_AR_COLUMNS = [
    'meaning_ar',
    'meaningar',
    'flex_value_meaning_ar',
    'flexvaluemeaningar',
    'leave_reason_ar',
    'description_ar',
    'valuear',
    'value_ar',
    'dataar',
    'data_ar',
    'placear',
    'place_ar',
    'defaultvaluear',
    'default_value_ar',
    'namear',
    'name_ar',
  ];

  /** Column that groups the multi-type LOVs (DEP_LOOKUP_LOV exposes `D_DATA_TYPE`). */
  private static readonly TYPE_COLUMNS = ['datatype', 'data_type', 'd_data_type', 'lookup_type'];

  /** Never used as a label by the generic fallback. */
  private static readonly TECHNICAL_COLUMNS = new Set([
    'username',
    'user_name',
    'person_id',
    'employee_number',
    'object_version_number',
    'language',
    'lang',
    ...LovMapper.TYPE_COLUMNS,
  ]);

  static toItem(row: Record<string, any>, _lang: Lang): LovItem {
    const codeColumn = this.firstColumn(row, this.CODE_COLUMNS);
    const code = codeColumn ? str(row, codeColumn) : undefined;
    const meaningColumn =
      this.firstColumn(row, this.MEANING_COLUMNS) ?? this.fallbackLabelColumn(row, codeColumn);
    const meaning = meaningColumn ? str(row, meaningColumn) : undefined;
    // Sanaad names an Arabic column after its English twin plus `_AR`, so the
    // twin is derived from the label column instead of being listed by name:
    // the vocabularies below cover barely half of the LOV views, and the rest
    // (MARITAL_STATUS_AR, TYPE_OF_PHONE_AR, D_DATA_AR, FLEX_VALUE_AR, ...)
    // silently lost their Arabic and answered `lang=ar` in English.
    const meaningAr =
      this.arTwin(row, meaningColumn) ??
      this.arTwin(row, codeColumn) ??
      this.firstArString(row, this.MEANING_AR_COLUMNS);
    const type = this.firstString(row, this.TYPE_COLUMNS);

    return {
      code: code ?? meaning ?? '',
      meaning: meaning ?? code ?? '',
      meaningAr,
      // Always the English label: `meaning` is localized (swapped for the
      // Arabic twin) by the ResponseInterceptor on lang=ar, while `used_value`
      // has no *Ar twin and therefore survives untouched — submits bind it.
      used_value: meaning ?? code ?? '',
      ...(type ? { type } : {}),
    };
  }

  static toItems(rows: Record<string, any>[], lang: Lang): LovItem[] {
    return rows.map((r) => this.toItem(r, lang));
  }

  /** Arabic twin of a column, by the `<COLUMN>_AR` convention every view follows. */
  private static arTwin(row: Record<string, any>, column: string | undefined): string | undefined {
    if (!column) return undefined;
    for (const suffix of ['_ar', 'ar']) {
      const value = strAr(row, `${column}${suffix}`);
      if (value !== undefined && value !== '') return value;
    }
    return undefined;
  }

  /**
   * Label column for a LOV whose columns are not in the documented
   * vocabularies: the first descriptive column that is neither the code
   * column, an id, nor a technical column.
   */
  private static fallbackLabelColumn(
    row: Record<string, any>,
    codeColumn: string | undefined,
  ): string | undefined {
    return Object.keys(row).find((k) => {
      const lower = k.toLowerCase();
      if (codeColumn && lower === codeColumn.toLowerCase()) return false;
      if (this.TECHNICAL_COLUMNS.has(lower)) return false;
      // Surrogate keys and Arabic twins are never the English label. Only a
      // suffix on a word boundary counts, so `academic_year` is not read as
      // Arabic and `visa_validity` is not read as an id.
      if (lower === 'id' || lower.endsWith('_id')) return false;
      if (lower.endsWith('_ar') || this.MEANING_AR_COLUMNS.includes(lower)) return false;
      return col(row, k) != null;
    });
  }

  private static firstColumn(row: Record<string, any>, names: string[]): string | undefined {
    return names.find((name) => {
      const value = str(row, name);
      return value !== undefined && value !== '';
    });
  }

  private static firstString(row: Record<string, any>, names: string[]): string | undefined {
    const name = this.firstColumn(row, names);
    return name ? str(row, name) : undefined;
  }

  private static firstArString(row: Record<string, any>, names: string[]): string | undefined {
    for (const name of names) {
      const value = strAr(row, name);
      if (value !== undefined && value !== '') return value;
    }
    return undefined;
  }
}
