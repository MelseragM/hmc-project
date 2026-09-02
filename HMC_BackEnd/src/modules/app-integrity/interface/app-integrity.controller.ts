import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { SkipIntegrity } from '@core/integrity/skip-integrity.decorator';
import { AppIntegrityService } from '../application/app-integrity.service';

export class RegisterAttestationDto {
  @ApiProperty({ description: 'Key identifier returned by DCAppAttestService.generateKey().' })
  @IsString()
  @IsNotEmpty()
  keyId!: string;

  @ApiProperty({ description: 'Base64 of the attestation object from attestKey().' })
  @IsString()
  @IsNotEmpty()
  attestation!: string;

  @ApiProperty({ description: 'The challenge this attestation was produced for.' })
  @IsString()
  @IsNotEmpty()
  challenge!: string;
}

/**
 * Device attestation setup.
 *
 * Both routes are exempt from the integrity guard itself â€” a device cannot
 * prove itself before it has registered, and requiring a challenge in order to
 * get a challenge would never terminate.
 */
@ApiTags('app-integrity')
@ApiBearerAuth()
@SkipIntegrity()
@Controller('app-integrity')
export class AppIntegrityController {
  constructor(private readonly service: AppIntegrityService) {}

  /**
   * A one-time nonce. Both platforms need one â€” iOS to attest and to assert,
   * Android only if you choose to bind the token to a server value rather than
   * to the request body.
   */
  @Get('challenge')
  @ApiOperation({
    summary: 'Issue a one-time attestation challenge',
    operationId: 'appIntegrity_challenge',
  })
  @ApiOkResponse({ schema: { example: { challenge: 'q1w2e3...', expiresInMs: 300000 } } })
  async challenge(@CurrentUser() user: AuthenticatedUser) {
    return { challenge: await this.service.issueChallenge(user.username) };
  }

  /**
   * iOS one-time registration. Android has no equivalent: its token is
   * self-contained and nothing is stored.
   */
  @Post('ios/register')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Register an App Attest key (iOS, once per install)',
    operationId: 'appIntegrity_registerIos',
  })
  @ApiOkResponse({ schema: { example: { status: 'success', message: 'Device attested.' } } })
  async registerIos(
    @Body() dto: RegisterAttestationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const verdict = await this.service.registerIosKey({ ...dto, username: user.username });
    // The reason is deliberately not returned: it would tell a probing client
    // exactly which check to defeat next. It is in the server log.
    return verdict.ok
      ? { message: 'Device attested.' }
      : { message: 'Attestation could not be verified.', verified: false };
  }
}
