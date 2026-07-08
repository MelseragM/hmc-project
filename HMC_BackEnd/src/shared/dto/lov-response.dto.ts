import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LovItem } from '../domain/lov-item';

export class LovItemDto implements LovItem {
  @ApiProperty({ example: 'M' })
  code!: string;

  @ApiProperty({ example: 'Married' })
  meaning!: string;

  @ApiPropertyOptional({ example: 'متزوج' })
  meaningAr?: string;
}

export class LovResponseDto {
  @ApiProperty({ type: [LovItemDto] })
  items!: LovItemDto[];
}
