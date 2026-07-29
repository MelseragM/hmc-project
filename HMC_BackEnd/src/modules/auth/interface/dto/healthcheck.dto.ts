import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** API-1 — Health Check request (app launch). Note: uses `deviceimei` (not `imeinumber`). */
export class HealthCheckRequestDto {
  @ApiProperty({ example: '356789012345678', description: 'Device IMEI.' })
  @IsString()
  @IsNotEmpty()
  deviceimei!: string;

  @ApiPropertyOptional({ example: 'Android' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: '2026-01-02T14:10:00' })
  @IsOptional()
  @IsString()
  sysdate?: string;

  @ApiPropertyOptional({ example: 'Sanaad' })
  @IsOptional()
  @IsString()
  appname?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;
}

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'No', enum: ['Yes', 'No'] })
  appDowntime!: string;

  @ApiProperty({ example: '' })
  downtimeStart!: string;

  @ApiProperty({ example: '' })
  downtimeEnd!: string;

  @ApiProperty({
    example: 'R',
    description: 'Update requirement: R = not required, O = optional, M = mandatory.',
  })
  updatetype!: string;
}
