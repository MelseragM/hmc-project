import { LovMapper } from './lov.mapper';

/**
 * RET_FRM_LEAV_PR runs TO_NUMBER on p_leave_details, so op 56 needs the leave's
 * ABSENCE_ATTENDANCE_ID — every text form answers ORA-01722. The op 55 LOV used
 * to expose only the display string, which left the id unreachable and the
 * endpoint uncallable. `used_value` now carries the id so the rule "submits
 * bind used_value" holds here too; the label stays in `meaning` for the picker.
 */
describe('LOV rows that carry a submit id', () => {
  const RFL_ROW = {
    USER_NAME: 'AIBRAHIM39',
    LEAVE: 'Casual Leave|Leave Start Date : 19-APR-2026 and Leave End Date : 19-APR-2026',
    ABSENCE_ATTENDANCE_ID: 56949953,
  };

  it('binds the id and displays the label', () => {
    const item = LovMapper.toItem(RFL_ROW, 'en');

    expect(item.used_value).toBe('56949953');
    expect(item.code).toBe('56949953');
    expect(item.meaning).toContain('Casual Leave');
  });

  it('leaves ordinary LOVs on the label', () => {
    const item = LovMapper.toItem({ CODE: 'M', MEANING: 'Qatar Mobile Number' }, 'en');

    expect(item.used_value).toBe('Qatar Mobile Number');
    expect(item.code).toBe('M');
  });

  it('does not treat every id column as the value', () => {
    // FLEX_VALUE_ID is already a documented CODE column, not a submit value
    const item = LovMapper.toItem(
      { FLEX_VALUE_ID: '315540', FLEX_VALUE_MEANING: 'Primary' },
      'en',
    );

    expect(item.used_value).toBe('Primary');
  });
});
