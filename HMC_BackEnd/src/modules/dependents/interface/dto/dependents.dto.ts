import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** op 64 — dependent LOV query. DEP_LOOKUP_LOV mixes several vocabularies in one view. */
export class DependentLovQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    example: 'CONTACT',
    description:
      "Optional filter on the view's grouping column (Oracle D_DATA_TYPE) — returns only the rows of that type (e.g. relationships) instead of the full mixed list.",
  })
  @IsOptional()
  @IsString()
  data_type?: string;
}

const IDENTITY_FIELDS = [
  'p_title',
  'p_middle_name',
  'p_suffix',
  'p_prefix',
  'p_email_address',
  'p_relationship_start_date',
  'p_national_identifier',
  'p_passport_number',
  'p_pp_issue_date',
  'p_pp_expiry_date',
  'p_place_of_issue',
  'p_country_of_issue',
  'p_visa_type',
  'p_visa_number',
  'p_visa_issue_date',
  'p_visa_expiry_date',
  'p_visa_validity',
  'p_id_number',
  'p_id_expiry_date',
  'p_id_issue_date',
  'p_job_as_in_qid',
  'p_type_of_sponsorship',
  'p_sponsor_contact_name',
  'p_other_sponsor',
] as const;

const ADDRESS_FIELDS = [
  'p_main_address',
  'p_primary_flag',
  'p_address_type',
  'p_country',
  'p_address_line1',
  'p_address_line2',
  'p_address_line3',
  'p_city',
  'p_town_or_city',
  'p_region_1',
  'p_region_2',
  'p_region_3',
  'p_region1',
  'p_region2',
  'p_region3',
  'p_po_box',
] as const;

export class AddDependentRequestDto {
  @RequiredString('John')
  p_first_name!: string;

  @RequiredString('Doe')
  p_last_name!: string;

  @RequiredString('Son')
  p_relationship!: string;

  @RequiredString('Male')
  p_gender!: string;

  @RequiredString('19900101')
  p_date_of_birth!: string;

  @RequiredString('20260809')
  p_effective_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(AddDependentRequestDto, [
  ...IDENTITY_FIELDS,
  'p_phone_type',
  'p_phone_number',
  'p_phone_enabled',
  ...ADDRESS_FIELDS,
  'p_employment_status',
  'p_comments',
  ...ATTACHMENT_FIELDS,
]);

export class UpdateDependentRequestDto {
  @RequiredString('4668195')
  p_dependent_id!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(UpdateDependentRequestDto, [
  'p_title',
  'p_first_name',
  'p_middle_name',
  'p_last_name',
  'p_suffix',
  'p_prefix',
  'p_email_address',
  'p_relationship',
  'p_relation_ship',
  'p_relationship_start_date',
  'p_relation_ship_start_date',
  'p_passport_number',
  'p_date_of_issue',
  'p_date_of_expire',
  'p_place_of_issue',
  'p_country_of_issue',
  'p_visa_type',
  'p_visa_number',
  'p_date_of_issue_visa',
  'p_date_of_expire_visa',
  'p_visa_validity',
  'p_visa_validy',
  'p_id_number',
  'p_expiry_date',
  'p_date_of_issue_qid',
  'p_date_of_issuue_qid',
  'p_type_of_sponsorship',
  'p_type_of_sponsership',
  'p_name_of_contact',
  'p_name_of_sponsor',
  'p_gender',
  'p_gendar',
  'p_qid_number',
  'p_date_of_birth',
  'p_effective_date',
  'p_address_id',
  ...ADDRESS_FIELDS,
  'p_phone_id',
  'p_phone_type',
  'p_phone_number',
  'p_phone_enabled',
  'p_phone_id1',
  'p_phone_type1',
  'p_phone_number1',
  'p_phone_enabled1',
  'p_employment_status',
  'p_comments',
  ...ATTACHMENT_FIELDS,
]);

export class DeleteDependentRequestDto {
  @RequiredString('4668195')
  p_dependent_id!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(DeleteDependentRequestDto, [
  'p_relation_ship_end_date',
  'p_relationship_end_date',
  'p_contact_type',
  'p_relation_ship',
  'p_relationship',
  ...ATTACHMENT_FIELDS,
]);

export class PassportApplyRequestDto {
  @RequiredString('A498989')
  p_passport_number!: string;

  @RequiredString('20260121')
  p_date_of_issue!: string;

  @RequiredString('20360121')
  p_date_of_expiry!: string;

  @RequiredString('Normal')
  p_type_of_passport!: string;

  @RequiredString('Doha')
  p_place_of_issue!: string;

  @RequiredString('QA')
  p_country_of_issue!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(PassportApplyRequestDto, ATTACHMENT_FIELDS);
