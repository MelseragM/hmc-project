import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
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

/** PHONE_PKG.ADD_OR_UPDATE_PHONE input params (Sanaad spec — UPDATE_PHONE_NUMBER). */
const UPSERT_PHONE_PARAMS = ['p_user_name', 'p_phone', 'p_language'] as const;

/** DEL_PHONE_NUMBER_PR input params (Sanaad spec — DELETE_PHONE_DETAILS_SUBMIT). */
const DELETE_PHONE_PARAMS = [
  'p_user_name',
  'p_phone_id',
  'p_phone_type',
  'p_phone_number',
  'p_language',
] as const;

/** CREATE_ADDRESS_PR input params (Sanaad spec — CREATE_ADDRESS_PR). */
const CREATE_ADDRESS_PARAMS = [
  'p_user_name',
  'p_effective_date',
  'p_main_address',
  'p_primary_flag',
  'p_country',
  'p_address_type',
  'p_address_line1',
  'p_address_line2',
  'p_address_line3',
  'p_town_or_city',
  'p_region1',
  'p_region2',
  'p_region3',
  'p_po_box',
  'p_language',
] as const;

/** UPD_ADDRESS_PR input params (Sanaad spec — UPDATE_ADDRESS_SUBMIT). */
const UPDATE_ADDRESS_PARAMS = [
  'p_user_name',
  'p_address_id',
  'p_address_line1',
  'p_address_line2',
  'p_address_line3',
  'p_city',
  'p_region1',
  'p_region2',
  'p_region3',
  'p_po_box',
  'p_address_type',
  'p_country',
  'p_effective_date',
  'p_language',
] as const;

/**
 * op 28 — UPDATE_PHONE_NUMBER via PHONE_PKG.ADD_OR_UPDATE_PHONE, which takes the
 * phone list as a JSON array string and parses it in Oracle. op 32 — delete via
 * DEL_PHONE_NUMBER_PR.
 *
 * Both go through `callSubmitProc`, which builds the call from the procedure's
 * declared arguments: the phone upsert previously appended assumed
 * `p_status`/`p_message` OUT arguments and failed with `PLS-00306: wrong number
 * or types of arguments`.
 */
@Injectable()
export class PhoneOracleRepository extends BaseOracleRepository implements PhoneRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  async upsert(cmd: UpsertPhoneCommand): Promise<SubmitResult> {
    const phonePayload = cmd.phones.map((p) => ({
      P_PHONE_ID: p.phoneId ?? null,
      P_OBJECT_VERSION_NUMBER: p.objectVersionNumber ?? null,
      P_PHONE_TYPE: p.phoneType,
      P_PHONE_NUMBER: p.phoneNumber,
    }));

    return this.callSubmitProc(ORACLE_OBJECTS.PHONE_PKG_ADD_OR_UPDATE, UPSERT_PHONE_PARAMS, {
      p_user_name: cmd.username,
      p_phone: JSON.stringify(phonePayload),
      p_language: toOracleLanguage(cmd.lang),
    });
  }

  async delete(cmd: DeletePhoneCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.DEL_PHONE_NUMBER_PR, DELETE_PHONE_PARAMS, {
      p_user_name: cmd.username,
      p_phone_id: cmd.phoneId,
      p_phone_type: cmd.phoneType,
      p_phone_number: cmd.phoneNumber,
      p_language: toOracleLanguage(cmd.lang),
    });
  }
}

/** op 29 (CREATE_ADDRESS_PR) / op 25 (UPD_ADDRESS_PR). */
@Injectable()
export class AddressOracleRepository extends BaseOracleRepository implements AddressRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  async create(cmd: AddressCommand): Promise<SubmitResult> {
    return this.callSubmitProc(
      ORACLE_OBJECTS.CREATE_ADDRESS_PR,
      CREATE_ADDRESS_PARAMS,
      this.values(cmd),
    );
  }

  async update(cmd: AddressCommand): Promise<SubmitResult> {
    return this.callSubmitProc(
      ORACLE_OBJECTS.UPD_ADDRESS_PR,
      UPDATE_ADDRESS_PARAMS,
      this.values(cmd),
    );
  }

  /** Merge the posted p_* body with the enforced user + resolved language. */
  private values(cmd: AddressCommand): Record<string, unknown> {
    return { ...cmd.fields, p_language: toOracleLanguage(cmd.lang), p_user_name: cmd.username };
  }
}
