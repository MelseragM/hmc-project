import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { toOracleLanguage } from '@shared/domain/lang';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { TicketRepository, TicketRequestCommand } from '../../domain/annual-ticket.repository';

/** TICKET_REQ_PR input params (Sanaad spec — Submit_Annual_Ticket request template). */
const TICKET_REQ_PARAMS = [
  'p_user_name',
  'p_request_for',
  'p_employee',
  'p_passenger1',
  'p_passenger2',
  'p_passenger3',
  'p_passenger4',
  'p_request_type',
  'p_contractual_year',
  'p_traveling_dest',
  'p_travel_class',
  'p_comments',
  ...BaseOracleRepository.attachmentParams(),
  'p_language',
] as const;

/** op 67 — Submit_Annual_Ticket (TICKET_REQ_PR). */
@Injectable()
export class TicketOracleRepository extends BaseOracleRepository implements TicketRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  async apply(cmd: TicketRequestCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.TICKET_REQ_PR, TICKET_REQ_PARAMS, {
      ...cmd.fields,
      p_language: toOracleLanguage(cmd.lang),
      p_user_name: cmd.username,
    });
  }
}
