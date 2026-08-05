import { LovMapper } from './lov.mapper';

/**
 * The LOV endpoints returned the code as the label ({"code":"AD","meaning":"AD"},
 * {"code":"315540","meaning":"315540"}) because the mapper only probed
 * meaning-style column names and then fell back to the first non-null column.
 * These cases pin the column vocabularies the Sanaad mapping documents.
 */
describe('LovMapper', () => {
  const map = (row: Record<string, unknown>) => LovMapper.toItem(row, 'en');

  it('reads COUNTRY_LOV labels from VALUE, not from CODE', () => {
    expect(map({ CODE: 'AD', VALUE: 'Andorra' })).toMatchObject({
      code: 'AD',
      meaning: 'Andorra',
    });
  });

  it('reads value-set LOVs from FLEX_VALUE_MEANING and keys them by FLEX_VALUE', () => {
    expect(
      map({
        FLEX_VALUE_ID: '315540',
        FLEX_VALUE: 'Elementary',
        FLEX_VALUE_MEANING: 'Elementary',
      }),
    ).toMatchObject({ code: 'Elementary', meaning: 'Elementary' });
  });

  it('exposes the DEP_LOOKUP_LOV grouping type so the mixed rows can be told apart', () => {
    expect(map({ CODE: '01', DATA: 'Spouse', DATATYPE: 'CONTACT' })).toMatchObject({
      code: '01',
      meaning: 'Spouse',
      type: 'CONTACT',
    });
  });

  it('decodes the URL-encoded Arabic label', () => {
    expect(map({ CODE: 'QA', VALUE: 'Qatar', VALUEAR: '%D9%82%D8%B7%D8%B1' }).meaningAr).toBe(
      'قطر',
    );
  });

  it('never labels a row with its surrogate id or the username scope', () => {
    expect(map({ ESTABLISHMENT_ID: '2', NAME: 'A J John Memorial High School', USERNAME: 'V-X' })).toMatchObject(
      { code: '2', meaning: 'A J John Memorial High School' },
    );
  });

  it('falls back to the only descriptive column of a single-column LOV', () => {
    expect(map({ ACADEMIC_YEAR: '2025-2026' })).toMatchObject({
      code: '2025-2026',
      meaning: '2025-2026',
    });
  });
});
