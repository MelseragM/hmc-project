import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LookupsService } from '@lookups/application/lookups.service';
import {
  DEPENDENT_REPOSITORY,
  DependentRepository,
  PASSPORT_REPOSITORY,
  PassportRepository,
} from '../domain/dependents.repository';

/** Dependent add/update/delete + LOV (ops 65, 24, 31, 64). */
@Injectable()
export class DependentService {
  constructor(
    @Inject(DEPENDENT_REPOSITORY) private readonly repo: DependentRepository,
    private readonly lookups: LookupsService,
  ) {}

  add(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.add({ username: user.username, lang, fields });
  }

  update(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.update({ username: user.username, lang, fields });
  }

  delete(
    dependentId: string,
    fields: Record<string, unknown>,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.delete({ username: user.username, lang, dependentId, fields });
  }

  dependentLov(lang: Lang, dataType?: string): Promise<LovItem[]> {
    return this.lookups.getByObject(
      ORACLE_OBJECTS.DEP_LOOKUP_LOV,
      lang,
      undefined,
      dataType ? { dataType } : undefined,
    );
  }
}

/** Passport types/apply/issue-place (ops 33, 34, 49). */
@Injectable()
export class PassportService {
  constructor(
    @Inject(PASSPORT_REPOSITORY) private readonly repo: PassportRepository,
    private readonly lookups: LookupsService,
  ) {}

  types(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.PASSPORT_TYPE, lang);
  }

  apply(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.apply({ username: user.username, lang, fields });
  }

  issuePlaceLov(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.DEP_PLACE_LOV, lang);
  }
}
