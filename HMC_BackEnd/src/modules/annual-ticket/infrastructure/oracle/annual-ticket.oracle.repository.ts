import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { TicketRepository, TicketRequestCommand } from '../../domain/annual-ticket.repository';

/** op 67 — Submit_Annual_Ticket (TICKET_REQ_PR). Bind not captured → notImplemented. */
@Injectable()
export class TicketOracleRepository extends BaseOracleRepository implements TicketRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async apply(_cmd: TicketRequestCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.TICKET_REQ_PR);
  }
}
