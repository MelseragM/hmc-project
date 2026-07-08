import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { col, str, strAr } from '@shared/utils/mapper.util';

/**
 * Maps a generic Oracle LOV/view row to a LovItem. Oracle LOV objects expose
 * varied column names; we probe the common ones. Arabic values are URL-decoded
 * here (Anticorruption Layer).
 */
export class LovMapper {
  private static readonly CODE_COLUMNS = ['code', 'lookup_code', 'value', 'id', 'meaning_code'];
  private static readonly MEANING_COLUMNS = [
    'meaning',
    'description',
    'display_value',
    'name',
    'meaning_en',
  ];
  private static readonly MEANING_AR_COLUMNS = [
    'meaning_ar',
    'meaningar',
    'description_ar',
    'name_ar',
  ];

  static toItem(row: Record<string, any>, _lang: Lang): LovItem {
    const code = this.firstString(row, this.CODE_COLUMNS) ?? '';
    const meaning = this.firstString(row, this.MEANING_COLUMNS) ?? code;
    const meaningAr = this.firstArString(row, this.MEANING_AR_COLUMNS);
    return { code, meaning, meaningAr };
  }

  static toItems(rows: Record<string, any>[], lang: Lang): LovItem[] {
    return rows.map((r) => this.toItem(r, lang));
  }

  private static firstString(row: Record<string, any>, names: string[]): string | undefined {
    for (const name of names) {
      const value = str(row, name);
      if (value !== undefined && value !== '') return value;
    }
    // Fallback: first non-null column value.
    const firstKey = Object.keys(row).find((k) => col(row, k) != null);
    return firstKey ? str(row, firstKey) : undefined;
  }

  private static firstArString(row: Record<string, any>, names: string[]): string | undefined {
    for (const name of names) {
      const value = strAr(row, name);
      if (value !== undefined && value !== '') return value;
    }
    return undefined;
  }
}
