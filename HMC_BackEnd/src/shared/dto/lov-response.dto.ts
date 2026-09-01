import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LovItem } from '../domain/lov-item';

export class LovItemDto implements LovItem {
  @ApiProperty({ example: 'M' })
  code!: string;

  @ApiProperty({ example: 'Married' })
  meaning!: string;

  @ApiPropertyOptional({ example: 'متزوج' })
  meaningAr?: string;

  @ApiProperty({
    example: 'Married',
    description:
      'The English meaning, always — regardless of lang. Submit procedures expect English values; bind this field back on submits.',
  })
  used_value!: string;

  @ApiPropertyOptional({
    example: 'CONTACT',
    description: 'Grouping type, returned by the multi-type LOVs (e.g. DEP_LOOKUP_LOV).',
  })
  type?: string;

  @ApiPropertyOptional({
    example: '56949953',
    description:
      "The row's record id, present only where a submit binds the id instead of the label — " +
      'today the return-from-leave LOV (op 55), whose id goes to op 56 `p_leave_details`. ' +
      'Additive: `code`/`meaning`/`used_value` are unchanged.',
  })
  id?: string;
}

export class LovResponseDto {
  @ApiProperty({ type: [LovItemDto] })
  items!: LovItemDto[];
}
