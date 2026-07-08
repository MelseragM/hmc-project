import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * op 48 — PersonalDetsUpdate. The full UPD_PERSONAL_INFO_PR signature is not
 * captured in the mapping (sample shows only p_user_name + p_language), so these
 * are placeholder fields. TODO(bind): finalize once the procedure spec is known.
 */
export class UpdatePersonalRequestDto {
  @ApiPropertyOptional({ example: 'M', description: 'Marital status code (EMP_MARITAL_LOV).' })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional({ example: 'name@hamad.qa' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'QA', description: 'Nationality code.' })
  @IsOptional()
  @IsString()
  nationality?: string;
}
