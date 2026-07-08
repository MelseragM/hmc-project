import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { EFFECTIVE_DATE_ALL } from '@shared/utils/date.util';

/** `dd-Mon-yyyy` display dates as used in the mapping (e.g. 12-Jun-2025). */
const DISPLAY_DATE = /^\d{2}-[A-Za-z]{3}-\d{4}$/;

/** op 9 — `?enum&lang&accurlpln&effectivedate`. `enum` carries the username form. */
export class LeaveBalanceQueryDto extends ProfileQueryDto {
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

/** ops 57/58/56 — amend/cancel/return (placeholder fields; TODO(bind)). */
export class LeaveMutationRequestDto {
  @ApiPropertyOptional({ example: '99001', description: 'Absence/leave request id.' })
  @IsOptional()
  @IsString()
  leaveRequestId?: string;

  @ApiPropertyOptional({ example: '14-Jun-2025' })
  @IsOptional()
  @IsString()
  effectiveDate?: string;
}
