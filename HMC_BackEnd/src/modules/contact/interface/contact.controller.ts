import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
  @ApiOperation({ summary: 'op 32 — Delete phone', operationId: 'contact_deletePhone' })
  @ApiOkResponse({ type: SubmitResultDto })
  deletePhone(
    @Body() dto: DeletePhoneRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.phone.delete(dto.phoneId, dto.objectVersionNumber, user, lang);
  }

  @Post('address')
  @ApiOperation({ summary: 'op 29 — Create address', operationId: 'contact_createAddress' })
  @ApiOkResponse({ type: SubmitResultDto })
  createAddress(
    @Body() dto: CreateAddressRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.address.create({ ...dto }, user, lang);
  }

  @Post('address/update')
  @ApiOperation({ summary: 'op 25 — Update address', operationId: 'contact_updateAddress' })
  @ApiOkResponse({ type: SubmitResultDto })
  updateAddress(
    @Body() dto: UpdateAddressRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.address.update({ ...dto }, user, lang);
  }

  @Get('lov/country')
  @ApiOperation({ summary: 'op 30 — Country LOV', operationId: 'contact_countryLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async countryLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.address.countryLov(q.lang) };
  }
}
