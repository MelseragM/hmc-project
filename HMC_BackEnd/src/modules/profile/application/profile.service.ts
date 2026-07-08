import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LookupsService } from '@lookups/application/lookups.service';
import { EmployeeProfile } from '../domain/entities/employee-profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/profile.repository';

/** Application service for profile (ops 2, 48, 63). */
@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly repo: ProfileRepository,
    private readonly lookups: LookupsService,
  ) {}

  getProfile(employeeNumber: string, lang: Lang): Promise<EmployeeProfile> {
    return this.repo.getProfile(employeeNumber, lang);
  }

  updatePersonal(
    fields: Record<string, unknown>,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.updatePersonal({ username: user.username, lang, fields });
  }

  maritalStatusLov(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.EMP_MARITAL_LOV, lang);
  }
}
