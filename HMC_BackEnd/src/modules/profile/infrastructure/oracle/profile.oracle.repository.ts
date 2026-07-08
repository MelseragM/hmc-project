import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { EmployeeProfile } from '../../domain/entities/employee-profile';
import { ProfileRepository, UpdatePersonalCommand } from '../../domain/profile.repository';
import { ProfileMapper } from './profile.mapper';

/**
 * op 2 assembles the profile from 6 views (parallelized). op 48
 * (UPD_PERSONAL_INFO_PR) bind signature is not fully captured → notImplemented.
 * See Docs_Ai/Repository Pattern/README.md.
 */
@Injectable()
export class ProfileOracleRepository extends BaseOracleRepository implements ProfileRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async getProfile(employeeNumber: string, lang: Lang): Promise<EmployeeProfile> {
    const [personalRows, phoneRows, addressRows, dependentPhoneRows, dependentAddressRows] =
      await Promise.all([
        this.readByEmployee(ORACLE_OBJECTS.PERSONAL_DETAILS_V, employeeNumber),
        this.readByEmployee(ORACLE_OBJECTS.EMP_PHONE_V, employeeNumber),
        this.readByEmployee(ORACLE_OBJECTS.EMP_OUT_ADDRESS_V, employeeNumber),
        this.readByEmployee(ORACLE_OBJECTS.DEP_PHONE_V, employeeNumber),
        this.readByEmployee(ORACLE_OBJECTS.PND_DEPENDENT_ADDR_V, employeeNumber),
      ]);

    return ProfileMapper.toProfile(
      { personalRows, phoneRows, addressRows, dependentPhoneRows, dependentAddressRows },
      lang,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updatePersonal(_cmd: UpdatePersonalCommand): Promise<SubmitResult> {
    // TODO(bind): capture full XXHMC_SND_UPD_PERSONAL_INFO_PR signature (sample only
    // shows p_user_name + p_language). Then bind fields explicitly and call().
    return this.notImplemented(ORACLE_OBJECTS.UPD_PERSONAL_INFO_PR);
  }
}
