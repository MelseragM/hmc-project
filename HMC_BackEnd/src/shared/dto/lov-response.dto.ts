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
}

export class LovResponseDto {
  @ApiProperty({ type: [LovItemDto] })
  items!: LovItemDto[];
}
