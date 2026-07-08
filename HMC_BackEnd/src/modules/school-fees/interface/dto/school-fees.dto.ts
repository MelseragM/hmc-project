import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';

/** op 52 — `?enum&acadyrstrtdt&lang` */
export class SchoolChildrenQueryDto extends ProfileQueryDto {
  @ApiProperty({ example: '20200202', description: 'Academic year start date token (yyyymmdd).' })
  @Matches(/^\d{8}$/, { message: 'acadyrstrtdt must be yyyymmdd.' })
  acadyrstrtdt!: string;
}

/** op 39 — school-fee request (placeholder fields; TODO(bind)). */
export class SchoolFeeRequestDto {
  @ApiProperty({ example: 'SCH-001', description: 'School name code (SCHOOL_NAME_LOV).' })
  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @ApiProperty({ example: 'TERM1', description: 'School term code (SCHOOL_TERM_LOV).' })
  @IsString()
  @IsNotEmpty()
  schoolTerm!: string;

  @ApiPropertyOptional({ example: 'PRIMARY', description: 'Education stage (EDU_STAGE_LOV).' })
  @IsOptional()
  @IsString()
  eduStage?: string;

  @ApiPropertyOptional({ example: '2024-2025', description: 'Academic year (ACAD_YR_STRT_END_LOV).' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional({ example: '5001', description: 'Child/dependent id.' })
  @IsOptional()
  @IsString()
  childId?: string;
}
