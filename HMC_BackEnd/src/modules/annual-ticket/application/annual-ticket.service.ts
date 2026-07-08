import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LookupsService } from '@lookups/application/lookups.service';
import { TICKET_REPOSITORY, TicketRepository } from '../domain/annual-ticket.repository';

/** Annual-ticket service (ops 66, 67). */
@Injectable()
export class AnnualTicketService {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly repo: TicketRepository,
    private readonly lookups: LookupsService,
  ) {}

  master(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.TICKET_MASTER, lang);
  }

  apply(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.apply({ username: user.username, lang, fields });
  }
}
