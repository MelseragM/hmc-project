import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';

export interface TicketRequestCommand {
  username: string;
  lang: Lang;
  fields: Record<string, unknown>;
}

/** Port: submit annual-ticket request (op 67). Master (66) via Lookups. */
export interface TicketRepository {
  apply(cmd: TicketRequestCommand): Promise<SubmitResult>;
}

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');
