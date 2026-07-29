import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@core/auth/decorators/public.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { SkipEnvelope } from '@core/http/response.interceptor';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { AuthService } from '../application/auth.service';
import { OnboardingService } from '../application/onboarding.service';
import { MpinService } from '../application/mpin.service';
import {
  LoginRequestDto,
  LoginResponseDto,
  MeResponseDto,
  StatusMessageDto,
} from './dto/auth.dto';
import {
  UserValidateRequestDto,
  UserValidateResponseDto,
  ValidateOtpRequestDto,
} from './dto/onboarding.dto';
import {
  ForgotMpinInitRequestDto,
  ForgotMpinInitResponseDto,
  ResetMpinRequestDto,
  SetMpinRequestDto,
} from './dto/mpin.dto';

/**
 * Sanaad auth journey (framework v1.0.0). All routes are @Public() (pre-auth) and
 * return the mobile-facing JSON shapes unwrapped via @SkipEnvelope(). See
 * Docs Project/ (auth framework) APIs 2-7; API-1 lives in HealthCheckController.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly onboarding: OnboardingService,
    private readonly mpin: MpinService,
  ) {}

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('initiate')
  @ApiOperation({ summary: 'API-2 — User Validate (LDAP + send OTP)', operationId: 'auth_initiate' })
  @ApiOkResponse({ type: UserValidateResponseDto })
  initiate(@Body() dto: UserValidateRequestDto): Promise<UserValidateResponseDto> {
    return this.onboarding.validateUser(dto);
  }

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('otp/validate')
  @ApiOperation({ summary: 'API-3 — Validate OTP', operationId: 'auth_validateOtp' })
  @ApiOkResponse({ type: StatusMessageDto })
  validateOtp(@Body() dto: ValidateOtpRequestDto): Promise<StatusMessageDto> {
    return this.onboarding.validateOtp(dto);
  }

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('mpin/update')
  @ApiOperation({ summary: 'API-4 — Set MPIN (first-time)', operationId: 'auth_setMpin' })
  @ApiOkResponse({ type: StatusMessageDto })
  setMpin(@Body() dto: SetMpinRequestDto): Promise<StatusMessageDto> {
    return this.mpin.setMpin(dto);
  }

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'API-5 — Login (MPIN → JWT + functionAccessList)', operationId: 'auth_login' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    return this.auth.login(dto);
  }

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('mpin/forgot')
  @ApiOperation({ summary: 'API-6 — Initiate Forgot MPIN (send OTP)', operationId: 'auth_forgotMpin' })
  @ApiOkResponse({ type: ForgotMpinInitResponseDto })
  forgotMpin(@Body() dto: ForgotMpinInitRequestDto): Promise<ForgotMpinInitResponseDto> {
    return this.mpin.forgotInitiate(dto);
  }

  @Public()
  @SkipEnvelope()
  @HttpCode(200)
  @Post('mpin/update/reset')
  @ApiOperation({ summary: 'API-7 — Reset MPIN (OTP + new MPIN)', operationId: 'auth_resetMpin' })
  @ApiOkResponse({ type: StatusMessageDto })
  resetMpin(@Body() dto: ResetMpinRequestDto): Promise<StatusMessageDto> {
    return this.mpin.resetMpin(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current authenticated identity', operationId: 'auth_me' })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: AuthenticatedUser): MeResponseDto {
    return this.auth.me(user);
  }
}
