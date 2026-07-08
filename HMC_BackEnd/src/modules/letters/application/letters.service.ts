import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LookupsService } from '@lookups/application/lookups.service';
import { LETTER_REPOSITORY, LetterRepository } from '../domain/letters.repository';

/** Letters service (ops 16, 17). op 16 fans out to 7 LOVs (parallelized). */
@Injectable()
export class LettersService {
  constructor(
    @Inject(LETTER_REPOSITORY) private readonly repo: LetterRepository,
    private readonly lookups: LookupsService,
  ) {}

  async getLetterLovs(lang: Lang, username?: string): Promise<Record<string, LovItem[]>> {
    const [mobileNo, defaultCopy, country, name, language, exitCopies, deliveryLoc] =
      await Promise.all([
        this.lookups.getByObject(ORACLE_OBJECTS.LETTER_MOBILE_NO_LOV, lang, username),
        this.lookups.getByObject(ORACLE_OBJECTS.EMP_LTR_DEFAULT_COPY, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.LETTER_COUNTRY_LOV, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.LETTER_NAME_LOV, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.LETTER_LANGUAGE_LOV, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.EXIT_COPIES_LOV, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.DELIVERY_LOC_V, lang),
      ]);
    return { mobileNo, defaultCopy, country, name, language, exitCopies, deliveryLoc };
  }

  submit(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.submit({ username: user.username, lang, fields });
  }
}
