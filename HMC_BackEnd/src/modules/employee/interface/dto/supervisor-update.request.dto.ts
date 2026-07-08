import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * op 36 — SUPERVISOR_PR. Full bind signature not captured in the mapping;
 * placeholder fields. TODO(bind).
 */
export class SupervisorUpdateRequestDto {
  @ApiPropertyOptional({ example: '053613', description: 'Target employee number.' })
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @ApiPropertyOptional({ example: 'V-NEWSUP', description: 'New supervisor username.' })
  @IsOptional()
  @IsString()
  supervisorUsername?: string;
}
