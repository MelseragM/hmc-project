import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** ops 65/24 — add/update dependent (placeholder fields; TODO(bind)). */
export class AddDependentRequestDto {
  @ApiProperty({ example: 'SPOUSE', description: 'Relationship code (DEP_LOOKUP_LOV).' })
  @IsString()
  relationship!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: '01-Jan-1990', description: 'Date of birth (dd-Mon-yyyy).' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}

export class UpdateDependentRequestDto extends AddDependentRequestDto {
  @ApiProperty({ example: '5001', description: 'Dependent id.' })
  @IsString()
  @IsNotEmpty()
  dependentId!: string;
}

/** op 31 — delete dependent. */
export class DeleteDependentRequestDto {
  @ApiProperty({ example: '5001' })
  @IsString()
  @IsNotEmpty()
  dependentId!: string;
}

/** op 34 — passport detail request (placeholder fields; TODO(bind)). */
export class PassportDetailRequestDto {
  @ApiProperty({ example: '5001', description: 'Dependent id.' })
  @IsString()
  dependentId!: string;

  @ApiProperty({ example: 'ORD', description: 'Passport type (PASSPORT_TYPE).' })
  @IsString()
  passportType!: string;

  @ApiPropertyOptional({ example: 'A1234567' })
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional({ example: 'QA', description: 'Issue place (DEP_PLACE_LOV).' })
  @IsOptional()
  @IsString()
  issuePlace?: string;
}
