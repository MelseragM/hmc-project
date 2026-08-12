import { BaseOracleRepository } from './base.repository';
import { OracleService } from './oracle.service';

/** Minimal concrete subclass so the protected `toSubmitResult` can be tested
 * directly, without going through a real Oracle call. */
class TestRepository extends BaseOracleRepository {
  constructor() {
    super({} as OracleService);
  }

  public expose(out: Record<string, any>) {
    return this.toSubmitResult(out);
  }
}

/**
 * XXHMC_SND_APPROVE_REJECT_PR returned `{ p_success_flag: null, p_error_msg:
 * null, p_error_msg_ar: null }` for a decision on an item that does not exist
 * (or was already actioned) — every OUT bind left unset instead of
 * `p_success_flag = 'N'` with an explanation. Before this fix that produced
 * the generic "Operation failed", indistinguishable from a real failure.
 */
describe('BaseOracleRepository.toSubmitResult', () => {
  const repo = new TestRepository();

  it('reports a specific message when every OUT bind is null (no signal at all)', () => {
    const result = repo.expose({
      p_success_flag: null,
      p_error_msg: null,
      p_error_msg_ar: null,
    });
    expect(result.status).toBe('error');
    expect(result.successflag).toBe('N');
    expect(result.errormessage).toBe(
      'No matching record was found for this request, or it has already been processed.',
    );
  });

  it('still reports the real message for an ordinary business-rule failure', () => {
    const result = repo.expose({
      p_success_flag: 'N',
      p_error_msg: 'Dependent does not exist',
      p_error_msg_ar: 'المعال غير موجود.',
    });
    expect(result.status).toBe('error');
    expect(result.errormessage).toBe('Dependent does not exist');
  });

  it('still reports success when the flag is S/Y', () => {
    const result = repo.expose({ p_success_flag: 'Y', p_error_msg: null });
    expect(result.status).toBe('success');
    expect(result.successflag).toBe('S');
    expect(result.errormessage).toBe('Success');
  });
});
