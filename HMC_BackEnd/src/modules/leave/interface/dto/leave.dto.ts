import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PersonIdQueryDto } from '@shared/dto/common-query.dto';
import { EFFECTIVE_DATE_ALL } from '@shared/utils/date.util';
import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** `dd-Mon-yyyy` display dates as used in the mapping (e.g. 12-Jun-2025). */
const DISPLAY_DATE = /^\d{2}-[A-Za-z]{3}-\d{4}$/;

/** op 9 — `?person_id&lang&accurlpln&effectivedate`. */
export class LeaveBalanceQueryDto extends PersonIdQueryDto {
  @ApiPropertyOptional({ description: 'Accrual plan id.' })
  @IsOptional()
  @IsString()
  accurlpln?: string;

  @ApiPropertyOptional({ default: EFFECTIVE_DATE_ALL, example: EFFECTIVE_DATE_ALL })
  @IsOptional()
  @IsString()
  effectivedate: string = EFFECTIVE_DATE_ALL;
}

/** op 10 — Leave submission (LEAV_OF_ABSEN_NEW_PR core params). */
export class ApplyLeaveRequestDto {
  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  absenceType!: string;

  @ApiPropertyOptional({ example: 'Personal' })
  @IsOptional()
  @IsString()
  absenceReason?: string;

  @ApiProperty({ example: '12-Jun-2025' })
  @IsString()
  @Matches(DISPLAY_DATE, { message: 'startDate must be dd-Mon-yyyy.' })
  startDate!: string;

  @ApiProperty({ example: '14-Jun-2025' })
  @IsString()
  @Matches(DISPLAY_DATE, { message: 'endDate must be dd-Mon-yyyy.' })
  endDate!: string;
}

/** op 47 — Leave duration calculation. */
export class LeaveCalcRequestDto {
  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  absenceType!: string;

  @ApiProperty({ example: '12-Jun-2025' })
  @IsString()
  @Matches(DISPLAY_DATE, { message: 'startDate must be dd-Mon-yyyy.' })
  startDate!: string;

  @ApiProperty({ example: '14-Jun-2025' })
  @IsString()
  @Matches(DISPLAY_DATE, { message: 'endDate must be dd-Mon-yyyy.' })
  endDate!: string;
}

/** op 57 — POST /leave/amend (HR_LEAV_AMEND_PR request template). */
export class LeaveAmendRequestDto {
  @RequiredString('Annual Leave')
  p_leave_type!: string;

  @RequiredString('62')
  p_leave_to_amend!: string;

  @RequiredString('20-Jun-2026')
  p_new_end_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(LeaveAmendRequestDto, ['p_comments', ...ATTACHMENT_FIELDS]);

/** op 58 — POST /leave/cancel (HR_LEAV_CANCEL_PR request template). */
export class LeaveCancelRequestDto {
  @RequiredString('Annual Leave')
  p_leave_type!: string;

  @RequiredString('62')
  p_leave_to_cancel!: string;

  @RequiredString('Plans changed')
  p_reason_for_cancel!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(LeaveCancelRequestDto, ['p_remarks', ...ATTACHMENT_FIELDS]);

/** op 56 — POST /leave/return (RET_FRM_LEAV_PR request template). */
export class LeaveReturnRequestDto {
  @RequiredString('62')
  p_leave_details!: string;

  @RequiredString('15-Jun-2026')
  p_return_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(LeaveReturnRequestDto, [
  'p_related_leave1',
  'p_related_leave2',
  'p_comments',
  ...ATTACHMENT_FIELDS,
]);
