import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** op 19 — QID_UPD (placeholder fields; TODO(bind)). */
export class QidUpdateRequestDto {
  @ApiProperty({ example: '28xxxxxxxxx', description: 'QID number.' })
  @IsString()
  qidNumber!: string;

  @ApiPropertyOptional({ example: '31-Dec-2030', description: 'QID expiry (dd-Mon-yyyy).' })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}

/** op 54 — RequestCompanyID (placeholder fields; TODO(bind)). */
export class CompanyIdRequestDto {
  @ApiPropertyOptional({ example: 'SIT-HQ', description: 'Work location code (SIT_WORK_LOC_LOV).' })
  @IsOptional()
  @IsString()
  workLocation?: string;

  @ApiPropertyOptional({ example: 'SIT-DEL', description: 'Delivery location code.' })
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  @ApiPropertyOptional({ example: 'LOST', description: 'Reason code (SIT_REASON_LOV).' })
  @IsOptional()
  @IsString()
  reason?: string;
}
