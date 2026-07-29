import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Common client/device context sent by the mobile app on auth requests.
 * Field names normalized to lowercase (the source doc is inconsistent, e.g.
 * appName/appname); the mobile client must send these keys.
 */
export class ClientContextDto {
  @ApiProperty({ example: 'hmc12345', description: 'Employee NT id / username.' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '356789012345678', description: 'Device IMEI.' })
  @IsString()
  @IsNotEmpty()
  imeinumber!: string;

  @ApiPropertyOptional({ example: 'Android' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'Sanaad' })
  @IsOptional()
  @IsString()
  appname?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: '2026-01-02T14:20:00' })
  @IsOptional()
  @IsString()
  sysdate?: string;
}
