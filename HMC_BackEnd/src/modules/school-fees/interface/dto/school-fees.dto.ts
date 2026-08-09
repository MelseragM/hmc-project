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

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 100;
}

export class SchoolFeeApplyRequestDto {
  @RequiredString('2025-2026')
  p_academic_year!: string;

  @RequiredString('20250901')
  p_acd_st_dt!: string;

  @RequiredString('20260630')
  p_acd_end_dt!: string;

  @RequiredString('Child Name')
  p_child_name!: string;

  @RequiredString('20150101')
  p_child_date_birth!: string;

  @RequiredString('School Name')
  p_school_name!: string;

  @RequiredString('Primary')
  p_educational_stage!: string;

  @RequiredString('Tuition')
  p_request_type!: string;

  @RequiredString('Term 1')
  p_term!: string;

  @RequiredString('1000')
  p_amount!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(SchoolFeeApplyRequestDto, [
  'p_passport_number',
  'p_rp_number',
  'p_receipt_number',
  'p_spouse_working',
  'p_comments',
  ...ATTACHMENT_FIELDS,
]);
