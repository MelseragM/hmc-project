import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PhoneItemDto {
  @ApiPropertyOptional({ description: 'Existing phone id (omit to create).' })
  @IsOptional()
  @IsString()
  phoneId?: string;

  @ApiPropertyOptional({ description: 'Object version number for updates.' })
  @IsOptional()
  @IsString()
  objectVersionNumber?: string;

  @ApiProperty({ example: 'MOBILE' })
  @IsString()
  @IsNotEmpty()
  phoneType!: string;

  @ApiProperty({ example: '+97455512345' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}

/** op 28 — UPDATE_PHONE_NUMBER (PHONE_PKG). */
export class UpdatePhoneRequestDto {
  @ApiProperty({ type: [PhoneItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PhoneItemDto)
  phones!: PhoneItemDto[];
}

/** op 32 — DELETE_PHONE. */
export class DeletePhoneRequestDto {
  @ApiProperty({ example: '12345' })
  @IsString()
  @IsNotEmpty()
  phoneId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectVersionNumber?: string;
}

/** op 29 — CREATE_ADDRESS (placeholder fields; TODO(bind)). */
export class CreateAddressRequestDto {
  @ApiPropertyOptional({ example: 'HOME' })
  @IsOptional()
  @IsString()
  addressType?: string;

  @ApiPropertyOptional({ example: 'QA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Doha' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;
}

/** op 25 — UPDATE_ADDRESS (placeholder fields; TODO(bind)). */
export class UpdateAddressRequestDto extends CreateAddressRequestDto {
  @ApiPropertyOptional({ example: '67890' })
  @IsOptional()
  @IsString()
  addressId?: string;
}
