import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { LeaveOracleRepository } from './leave.oracle.repository';

/**
 * op 56 binds `p_leave_details` into a VARCHAR2(60) inside
 * RET_FRM_LEAV_PR, while its own LOV (op 55) returns a ~75-character display
 * string — passing that through raised ORA-06502. The repository compacts the
 * value; these tests pin that behaviour, including the cases it must NOT touch.
 */
describe('LeaveOracleRepository — return-from-leave value compaction', () => {
  function make() {
    const call = jest.fn().mockResolvedValue({
      p_success_flag: 'Y',
      p_error_msg: null,
      p_error_msg_ar: null,
    });
    const ora = { call } as unknown as OracleService;
    // No dictionary: callSubmitProc falls back to the documented param list,
    // which is enough to observe the bound values.
    const schema = { resolveParams: jest.fn().mockResolvedValue([]) } as unknown as OracleSchemaService;
    return { repository: new LeaveOracleRepository(ora, schema), call };
  }

  const submit = async (details: string) => {
    const { repository, call } = make();
    await repository.returnFromLeave({
      username: 'AIBRAHIM39',
      lang: 'en',
      fields: { p_leave_details: details, p_return_date: '20-Apr-2026' },
    });
    return call.mock.calls[0][1].p_leave_details;
  };

  it('strips the LOV labels so the value fits the procedure buffer', async () => {
    const lovValue = 'Casual Leave|Leave Start Date : 19-APR-2026 and Leave End Date : 19-APR-2026';
    expect(lovValue.length).toBeGreaterThan(60);

    const bound = await submit(lovValue);

    expect(bound).toBe('Casual Leave|19-APR-2026|19-APR-2026');
    expect(bound.length).toBeLessThanOrEqual(60);
  });

  it('leaves an already-compact value untouched', async () => {
    const compact = 'Casual Leave|19-APR-2026|19-APR-2026';
    expect(await submit(compact)).toBe(compact);
  });

  it('does not rewrite a value it cannot parse', async () => {
    expect(await submit('Casual Leave')).toBe('Casual Leave');
    expect(await submit('Casual Leave|no dates here')).toBe('Casual Leave|no dates here');
  });
});

/**
 * None of the leave procedures declares `p_language` (checked against
 * ALL_ARGUMENTS for CANCEL, AMEND, RET_FRM_LEAV, LEAV_OF_ABSEN_NEW and
 * LEAVE_BALANCE, and confirmed by the DB team). Sending it produced a bind the
 * database threw away and a parameter list that misdescribed the contract.
 */
describe('LeaveOracleRepository — the leave procedures take no p_language', () => {
  function make() {
    const call = jest.fn().mockResolvedValue({ p_success_flag: 'Y', p_error_msg: null });
    const ora = { call } as unknown as OracleService;
    const schema = { resolveParams: jest.fn().mockResolvedValue([]) } as unknown as OracleSchemaService;
    return { repository: new LeaveOracleRepository(ora, schema), call };
  }

  const cmd = (fields: Record<string, unknown>) => ({
    username: 'AIBRAHIM39',
    lang: 'ar' as const,
    fields,
  });

  it('cancel binds the caller and the leave, and never p_language', async () => {
    const { repository, call } = make();

    await repository.cancel(
      cmd({
        p_leave_type: 'Casual Leave',
        p_leave_to_cancel: 'Casual Leave|19-APR-2026|19-APR-2026',
        p_reason_for_cancel: 'Plans changed',
      }),
    );

    const binds = call.mock.calls[0][1];
    expect(binds).toMatchObject({
      p_user_name: 'AIBRAHIM39',
      p_leave_type: 'Casual Leave',
      p_leave_to_cancel: 'Casual Leave|19-APR-2026|19-APR-2026',
    });
    expect(binds).not.toHaveProperty('p_language');
  });

  it('amend does the same', async () => {
    const { repository, call } = make();

    await repository.amend(
      cmd({
        p_leave_type: 'Annual Leave',
        p_leave_to_amend: 'Annual Leave|12-MAR-2026|12-MAR-2026',
        p_new_end_date: '13-MAR-2026',
      }),
    );

    expect(call.mock.calls[0][1]).not.toHaveProperty('p_language');
    expect(call.mock.calls[0][1].p_user_name).toBe('AIBRAHIM39');
  });

  it('the caller always wins over a p_user_name posted in the body', async () => {
    const { repository, call } = make();

    await repository.cancel(
      cmd({ p_user_name: 'SOMEONE-ELSE', p_leave_type: 'Casual Leave', p_leave_to_cancel: 'x' }),
    );

    expect(call.mock.calls[0][1].p_user_name).toBe('AIBRAHIM39');
  });
});
