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

/** op 32 — DELETE_PHONE_DETAILS_SUBMIT (DEL_PHONE_NUMBER_PR). */
export class DeletePhoneRequestDto {
  @ApiProperty({ example: '12345' })
  @IsString()
  @IsNotEmpty()
  phoneId!: string;

  @ApiPropertyOptional({ example: 'Qatar Mobile Number', description: 'Type of the phone to delete.' })
  @IsOptional()
  @IsString()
  phoneType?: string;

  @ApiPropertyOptional({ example: '+97455512345', description: 'Number of the phone to delete.' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
