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
  @ApiProperty({ example: '1574794', description: 'Existing phone id of the user (see GET /profile → phones[].phoneId).' })
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

/**
 * op 29 — CREATE_ADDRESS_PR. Example values are pinned to a combination
 * confirmed to work end-to-end against staging (2026-08-23: successflag S
 * with `Temporary Offer Address`). Rules verified live: `p_country` is the
 * country NAME from the op 30 LOV (`Qatar`, not `QA`), and creating a second
 * address of a type whose date range overlaps an existing one fails with
 * "You have already created an address ... which overlaps this date range".
 */
export class CreateAddressRequestDto {
  @RequiredString('20260823')
  p_effective_date!: string;

  @RequiredString('N')
  p_primary_flag!: string;

  @RequiredString('Qatar')
  p_country!: string;

  @RequiredString('Temporary Offer Address')
  p_address_type!: string;

  @RequiredString('Building 45')
  p_address_line1!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(
  CreateAddressRequestDto,
  ['p_main_address', 'p_address_line2', 'p_address_line3', 'p_town_or_city', 'p_region1', 'p_region2', 'p_region3', 'p_po_box'],
  {
    p_main_address: 'Al Sadd Street',
    p_address_line2: 'Street 12',
    p_address_line3: 'Zone 60',
    p_town_or_city: 'Doha',
    p_region1: 'Al Rayyan',
    p_region2: '',
    p_region3: '',
    p_po_box: '12345',
  },
);

/**
 * op 25 — UPD_ADDRESS_PR. Rules verified live on staging (2026-08-23,
 * successflag S with the pinned example): `p_address_id` must be an address
 * the caller OWNS (GET /profile → outsideAddresses[].addressId),
 * `p_address_type` must match that address's own type, `p_country` takes the
 * country NAME (`Qatar`; the 2-letter `QA` returns "Invalid Country"), and
 * Oracle date-tracks the change — repeating the same update with the same
 * `p_effective_date` fails, so use a fresh effective date per update.
 */
export class UpdateAddressRequestDto {
  @RequiredString('1720601')
  p_address_id!: string;

  @RequiredString('20260823')
  p_effective_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(
  UpdateAddressRequestDto,
  [
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
  ],
  {
    p_address_type: 'Primary Home Country Address',
    p_country: 'Qatar',
    p_address_line1: 'Building 45',
  },
);
