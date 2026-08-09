import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { AddressService, PhoneService } from '../application/contact.service';
import {
  CreateAddressRequestDto,
  DeletePhoneRequestDto,
  UpdateAddressRequestDto,
  UpdatePhoneRequestDto,
} from './dto/contact.dto';

/** Contact endpoints (ops 25, 27, 28, 29, 30, 32). See Docs_Ai/API/README.md. */
@ApiTags('contact')
@ApiBearerAuth()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly phone: PhoneService,
    private readonly address: AddressService,
  ) {}

  @Get('lov/phone-type')
  @ApiOperation({ summary: 'op 27 — Phone-type LOV', operationId: 'contact_phoneTypeLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async phoneTypeLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.phone.phoneTypeLov(q.lang) };
  }

  @Post('phone')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 28 — Update phone number(s)', operationId: 'contact_upsertPhone' })
  @ApiOkResponse({ type: SubmitResultDto })
  upsertPhone(
    @Body() dto: UpdatePhoneRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.phone.upsert(dto.phones, user, lang);
  }

  @Post('phone/delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 32 — Delete phone', operationId: 'contact_deletePhone' })
  @ApiOkResponse({ type: SubmitResultDto })
  deletePhone(
    @Body() dto: DeletePhoneRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.phone.delete(dto, user, lang);
  }

  @Post('address')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 29 — Create address', operationId: 'contact_createAddress' })
  @ApiOkResponse({ type: SubmitResultDto })
  createAddress(
    @Body() body: CreateAddressRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's CREATE_ADDRESS_PR body (p_* keys).
    return this.address.create(body, user, lang);
  }

  @Post('address/update')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 25 — Update address', operationId: 'contact_updateAddress' })
  @ApiOkResponse({ type: SubmitResultDto })
  updateAddress(
    @Body() body: UpdateAddressRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's UPDATE_ADDRESS_PR body (p_* keys, incl. p_address_id).
    return this.address.update(body, user, lang);
  }

  @Get('lov/country')
  @ApiOperation({ summary: 'op 30 — Country LOV', operationId: 'contact_countryLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async countryLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.address.countryLov(q.lang) };
  }
}
