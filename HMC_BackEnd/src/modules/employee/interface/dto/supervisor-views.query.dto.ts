import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LovUserQueryDto } from '@shared/dto/common-query.dto';

/**
 * op 35 — GET /employee/supervisor/views?username=&lang=&searchKeyWord=
 * `searchKeyWord` filters the supervisor employee list by FULL_NAME
 * (case-insensitive contains, applied Oracle-side before the row cap).
 */
export class SupervisorViewsQueryDto extends LovUserQueryDto {
  @ApiPropertyOptional({
    example: 'Hajar',
    description:
      'Case-insensitive substring filter on FULL_NAME ("000001 - Dr. Hajar Ahmed Hajar").',
  })
  @IsOptional()
  @IsString()
  searchKeyWord?: string;
}
