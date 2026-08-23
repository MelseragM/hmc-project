import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { LovUserQueryDto, ProfileQueryDto } from '@shared/dto/common-query.dto';
import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

export class SchoolChildrenQueryDto extends ProfileQueryDto {
  @ApiProperty({ example: '20200202', description: 'Academic year start date token (yyyymmdd).' })
  @Matches(/^\d{8}$/, { message: 'acadyrstrtdt must be yyyymmdd.' })
  acadyrstrtdt!: string;
}

export class SchoolLovQueryDto extends LovUserQueryDto {
  @ApiPropertyOptional({ example: 'Doha' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 100, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 100;
}

/**
 * op 39 — SCHOOL_FEE_PR. Example values verified against the live LOVs
 * (2026-08-23): `p_request_type` comes from the op 53 LOV (e.g. `Cash` — NOT
 * "Tuition"), `p_term` from the op 38 LOV (`Term1` — no space), the school
 * name from the op 37 LOV, and the child name/DOB from GET
 * /school-fees/children. NOTE: the staging DATABASE currently rejects even
 * fully valid payloads from inside the procedure (ORA-01403 / intermittent
 * ORA-00027 at line 114) — pending the DB team.
 */
export class SchoolFeeApplyRequestDto {
  @RequiredString('2025-2026')
  p_academic_year!: string;

  @RequiredString('20250901')
  p_acd_st_dt!: string;

  @RequiredString('20260630')
  p_acd_end_dt!: string;

  @RequiredString('Jerome Amir Sami Samir Ibrahim')
  p_child_name!: string;

  @RequiredString('20100923')
  p_child_date_birth!: string;

  @RequiredString('Al Arqam Academy')
  p_school_name!: string;

  @RequiredString('Primary')
  p_educational_stage!: string;

  @RequiredString('Cash')
  p_request_type!: string;

  @RequiredString('Term1')
  p_term!: string;

  @RequiredString('1000')
  p_amount!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(
  SchoolFeeApplyRequestDto,
  [
    'p_passport_number',
    'p_rp_number',
    'p_receipt_number',
    'p_spouse_working',
    'p_comments',
    ...ATTACHMENT_FIELDS,
  ],
  {
    p_passport_number: 'A38697134',
    p_rp_number: '31081804108',
    p_receipt_number: '123',
    p_spouse_working: 'No',
    p_comments: 'test',
    p_file_name1: 'receipt.pdf',
    p_attachment1: 'dGVzdCBhdHRhY2htZW50',
  },
);
