import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@core/auth/auth-user.interface';

/** op 1 — Login (flow out-of-band; body is a placeholder). */
export class LoginRequestDto {
  @ApiProperty({ example: 'V-NFERNANDO' })
  @IsString()
  username!: string;

  @ApiPropertyOptional({ description: 'Ignored by the placeholder dev flow.' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '1h' })
  expiresIn!: string;
}

export class MeResponseDto {
  @ApiProperty({ example: 'V-NFERNANDO' })
  username!: string;

  @ApiPropertyOptional({ example: '053613' })
  employeeNumber?: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles!: Role[];
}
