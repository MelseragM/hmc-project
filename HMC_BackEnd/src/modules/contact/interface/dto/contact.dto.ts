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
import { defineOptionalStringFields, RequiredString } from '@shared/dto/oracle-submit.dto';

export class PhoneItemDto {
  @ApiPropertyOptional({ description: 'Existing phone id (omit to create).' })
  @IsOptional()
  @IsString()
  phoneId?: string;

  @ApiPropertyOptional({ description: 'Object version number for updates.' })
  @IsOptional()
  @IsString()
  objectVersionNumber?: string;

  @ApiProperty({ example: 'Qatar Mobile Number', description: 'Exact phone-type LOV meaning.' })
  @IsString()
  @IsNotEmpty()
  phoneType!: string;

  @ApiProperty({ example: '55512345' })
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

export class CreateAddressRequestDto {
  @RequiredString('20240911')
  p_effective_date!: string;

  @RequiredString('Y')
  p_primary_flag!: string;

  @RequiredString('QA')
  p_country!: string;

  @RequiredString('Primary Local Address')
  p_address_type!: string;

  @RequiredString('Building 1')
  p_address_line1!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(CreateAddressRequestDto, [
  'p_main_address',
  'p_address_line2',
  'p_address_line3',
  'p_town_or_city',
  'p_region1',
  'p_region2',
  'p_region3',
  'p_po_box',
]);

export class UpdateAddressRequestDto {
  @RequiredString('312605')
  p_address_id!: string;

  @RequiredString('20240911')
  p_effective_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(UpdateAddressRequestDto, [
  'p_address_line1',
  'p_address_line2',
  'p_address_line3',
  'p_city',
  'p_region1',
  'p_region2',
  'p_region3',
  'p_po_box',
  'p_address_type',
  'p_country',
]);
