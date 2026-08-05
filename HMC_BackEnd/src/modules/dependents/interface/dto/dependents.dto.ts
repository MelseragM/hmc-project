import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * op 31 — delete dependent. The body is the spec's DELETE_DEPENDENT_PR payload
 * (p_* keys such as `p_relation_ship_end_date`, `p_contact_type`,
 * `p_relation_ship` and the attachment slots); only the dependent id is required
 * here, the rest is forwarded as-is and bound as NULL when omitted.
 */
export class DeleteDependentRequestDto {
  @ApiProperty({ example: '5001' })
  @IsString()
  @IsNotEmpty()
  p_dependent_id!: string;

  [key: string]: unknown;
}
