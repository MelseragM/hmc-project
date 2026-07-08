import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { LetterRepository, LetterSubmitCommand } from '../../domain/letters.repository';

/** op 17 — LetterReqSubmit (HR_EMPLYMNT_LTR_PR). Bind not captured → notImplemented. */
@Injectable()
export class LettersOracleRepository extends BaseOracleRepository implements LetterRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async submit(_cmd: LetterSubmitCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.HR_EMPLYMNT_LTR_PR);
  }
}
