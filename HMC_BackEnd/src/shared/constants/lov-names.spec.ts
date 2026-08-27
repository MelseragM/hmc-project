import { ORACLE_OBJECTS } from './oracle-objects';
import { LovMapper } from '@lookups/infrastructure/oracle/lov.mapper';
import { LOV_OBJECT, resolveLovObject } from './lov-names';

/**
 * The LOV registry maps a PUBLIC name to an Oracle object. When the two drift
 * apart the read fails with ORA-00942 and the client only sees a generic
 * HTTP 500 — which is exactly how employment status stayed broken until a
 * mobile developer reported it. These tests pin the cases where the public name
 * is not simply the object minus its `XXHMC_SND_` prefix.
 */
describe('LOV registry', () => {
  it('exposes employment status under the name Oracle actually uses', () => {
    // The view is XXHMC_SND_EMPLOYMENT_STATUS_V (verified in the database: it
    // holds the three dependent employment statuses). The `…_LOV` spelling does
    // not exist in Oracle, so it must not be offered either.
    expect(resolveLovObject('EMPLOYMENT_STATUS_V')).toBe('XXHMC_SND_EMPLOYMENT_STATUS_V');
    expect(resolveLovObject('EMPLOYMENT_STATUS_LOV')).toBeUndefined();
  });

  it('keeps the other names whose object does not share their spelling', () => {
    expect(resolveLovObject('PHONE_TYPE_LOV')).toBe(ORACLE_OBJECTS.PHONE_TYPE_V);
    expect(resolveLovObject('ABSENCE_TYPE_LOV')).toBe(ORACLE_OBJECTS.ABSENCE_TYPE_V);
    expect(resolveLovObject('PASSPORT_TYPE_LOV')).toBe(ORACLE_OBJECTS.PASSPORT_TYPE);
    expect(resolveLovObject('TICKET_MASTER_LOV')).toBe(ORACLE_OBJECTS.TICKET_MASTER);
    // legacy alias of BEREAV_RELAT_LOV — both must reach the same view
    expect(resolveLovObject('BEREAVED_RELATIONSHIP_LOV')).toBe(resolveLovObject('BEREAV_RELAT_LOV'));
  });

  it('only exposes objects the ORACLE_OBJECTS registry knows', () => {
    const known = new Set(Object.values(ORACLE_OBJECTS));
    for (const [name, object] of Object.entries(LOV_OBJECT)) {
      expect({ name, known: known.has(object) }).toEqual({ name, known: true });
    }
  });

  // Every Sanaad view names its Arabic column after the English one plus
  // `_AR`, but the mapper used to recognise them by name and the list covered
  // barely half the LOVs — the rest answered lang=ar in English. Each row here
  // is a real column layout taken from the database.
  it.each([
    // label is the code itself, no *_MEANING column at all
    [
      'EMPLOYMENT_STATUS_V',
      { FLEX_VALUE: 'Not Employed', FLEX_VALUE_AR: 'غير موظف' },
      { code: 'Not Employed', meaning: 'Not Employed', meaningAr: 'غير موظف' },
    ],
    [
      'EMP_MARITAL_LOV',
      { MARITAL_STATUS: 'Divorced', MARITAL_STATUS_AR: 'مطلق' },
      { code: 'Divorced', meaning: 'Divorced', meaningAr: 'مطلق' },
    ],
    [
      'PHONE_TYPE_V',
      {
        LOOKUP_CODE: 'XXHMC_EMG_INQTR',
        TYPE_OF_PHONE: 'Emergency contact number Inside Qatar',
        TYPE_OF_PHONE_AR: 'رقم اتصال للطوارئ داخل قطر',
      },
      {
        code: 'XXHMC_EMG_INQTR',
        meaning: 'Emergency contact number Inside Qatar',
        meaningAr: 'رقم اتصال للطوارئ داخل قطر',
      },
    ],
    [
      'DEP_LOOKUP_LOV',
      { CODE: 'C', D_DATA: 'Child', D_DATA_AR: 'ابن', D_DATA_TYPE: 'CONTACT' },
      { code: 'C', meaning: 'Child', meaningAr: 'ابن', type: 'CONTACT' },
    ],
    // a *_MEANING pair still wins over the code column's own twin
    [
      'YES_NO_LOV',
      {
        FLEX_VALUE: 'Yes',
        FLEX_VALUE_MEANING: 'Yes',
        FLEX_VALUE_MEANING_AR: 'نعم',
      },
      { code: 'Yes', meaning: 'Yes', meaningAr: 'نعم' },
    ],
  ])('reads the Arabic label of %s', (_view, row, expected) => {
    // used_value must stay English in both languages: submits bind it
    expect(LovMapper.toItem(row, 'ar')).toMatchObject({
      ...expected,
      used_value: expected.meaning,
    });
  });

  it('still rejects a name that is not a LOV at all', () => {
    // Employment DETAILS is a different feature with its own endpoint
    // (GET /employee/employment) — it must not resolve here.
    expect(resolveLovObject('EMPLOYMENT_DETAILS_V')).toBeUndefined();
    expect(resolveLovObject('SOMETHING_ELSE_V')).toBeUndefined();
  });
});
