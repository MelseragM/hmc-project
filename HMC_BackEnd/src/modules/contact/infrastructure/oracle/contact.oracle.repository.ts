import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { toOracleLanguage } from '@shared/domain/lang';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  AddressCommand,
  AddressRepository,
  DeletePhoneCommand,
  PhoneRepository,
  UpsertPhoneCommand,
} from '../../domain/contact.repository';

/**
 * op 28 — UPDATE_PHONE_NUMBER via PHONE_PKG.ADD_OR_UPDATE_PHONE. The IN binds
 * are known from the mapping (p_user_name, p_phone [JSON array string], p_language);
 * Oracle parses the JSON. OUT param names use the standard p_status/p_message
 * convention — TODO(verify) against the real package spec. op 32 (delete) bind
 * signature not captured → notImplemented.
 */
@Injectable()
export class PhoneOracleRepository extends BaseOracleRepository implements PhoneRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async upsert(cmd: UpsertPhoneCommand): Promise<SubmitResult> {
    const phonePayload = cmd.phones.map((p) => ({
      P_PHONE_ID: p.phoneId ?? null,
      P_OBJECT_VERSION_NUMBER: p.objectVersionNumber ?? null,
      P_PHONE_TYPE: p.phoneType,
      P_PHONE_NUMBER: p.phoneNumber,
    }));

    const out = await this.call<Record<string, any>>(
      `BEGIN ${ORACLE_OBJECTS.PHONE_PKG_ADD_OR_UPDATE}(
          p_user_name => :p_user_name,
          p_phone     => :p_phone,
          p_language  => :p_language,
          p_status    => :p_status,
          p_message   => :p_message); END;`,
      {
        p_user_name: cmd.username,
        p_phone: JSON.stringify(phonePayload),
        p_language: toOracleLanguage(cmd.lang),
        ...this.statusOutBinds(),
      },
    );
    return this.toSubmitResult(out);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(_cmd: DeletePhoneCommand): Promise<SubmitResult> {
    // TODO(bind): capture XXHMC_SND_DEL_PHONE_NUMBER_PR signature.
    return this.notImplemented(ORACLE_OBJECTS.DEL_PHONE_NUMBER_PR);
  }
}

/** op 29 (create) / op 25 (update) address. Bind signatures not captured → notImplemented. */
@Injectable()
export class AddressOracleRepository extends BaseOracleRepository implements AddressRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(_cmd: AddressCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.CREATE_ADDRESS_PR);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(_cmd: AddressCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.UPD_ADDRESS_PR);
  }
}
