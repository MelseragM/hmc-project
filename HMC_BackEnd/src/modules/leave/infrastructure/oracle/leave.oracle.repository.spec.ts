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

/**
 * op 9 is keyed by USERNAME on the API (client request 2026-08-27), but
 * LEAVE_BALANCE_PR's `p_user_name` actually expects the numeric PERSON_ID
 * (confirmed live) — so the repository resolves it via EMPLOYMENT_DETAILS_V.
 */
describe('LeaveOracleRepository — getBalance resolves username → PERSON_ID', () => {
  function make(personRows: Record<string, unknown>[] = [{ PERSON_ID: 26023 }]) {
    const query = jest.fn().mockResolvedValue(personRows);
    const callCursor = jest.fn().mockResolvedValue([{ LEAVE_TYPE: 'Annual', BALANCE: 10 }]);
    const ora = { query, callCursor } as unknown as OracleService;
    const schema = {
      resolveParams: jest.fn().mockResolvedValue([]),
      resolveKeyColumn: jest.fn().mockResolvedValue('user_name'),
    } as unknown as OracleSchemaService;
    return { repository: new LeaveOracleRepository(ora, schema), query, callCursor };
  }

  const QUERY = { username: 'AIBRAHIM39', lang: 'en' as const, effectiveDate: 'ALL' };

  it('looks the username up in EMPLOYMENT_DETAILS_V and binds the PERSON_ID', async () => {
    const { repository, query, callCursor } = make();

    const rows = await repository.getBalance(QUERY);

    expect(rows).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain('EMPLOYMENT_DETAILS_V');
    expect(callCursor.mock.calls[0][1]).toMatchObject({ p_user_name: '26023' });
  });

  it('caches the resolution per username', async () => {
    const { repository, query } = make();

    await repository.getBalance(QUERY);
    await repository.getBalance(QUERY);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('a legacy person_id skips the lookup entirely', async () => {
    const { repository, query, callCursor } = make();

    await repository.getBalance({ ...QUERY, username: undefined, personId: '852709' });

    expect(query).not.toHaveBeenCalled();
    expect(callCursor.mock.calls[0][1]).toMatchObject({ p_user_name: '852709' });
  });

  it('404s when the username has no EMPLOYMENT_DETAILS_V row', async () => {
    const { repository } = make([]);

    await expect(repository.getBalance(QUERY)).rejects.toMatchObject({ status: 404 });
  });

  it('400s when neither username nor person_id is supplied', async () => {
    const { repository } = make();

    await expect(
      repository.getBalance({ lang: 'en', effectiveDate: 'ALL' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
