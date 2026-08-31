import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ClientContextDto } from './client-context.dto';

/**
 * API-2 — User Validate request. Per the auth framework doc, this call carries
 * NO password: the username is looked up in LDAP (existence + valid-employee +
 * registered phone) and an OTP is sent to that phone. Credential proof happens
 * later via OTP (onboarding) and MPIN (login).
 */
export class UserValidateRequestDto extends ClientContextDto {}

/** API-2 — success carries onboarding info + requestid; failure carries status/message. */
export class UserValidateResponseDto {
  @ApiPropertyOptional({ example: 'employee nt id' })
  employeeusername?: string;

  @ApiPropertyOptional({ example: 'Name of employee' })
  employeename?: string;

  @ApiPropertyOptional({ example: 'Yes', description: 'First-time user flag.' })
  newuser?: string;

  @ApiPropertyOptional({ example: 'Yes', description: 'Valid-employee flag.' })
  employeeflag?: string;

  @ApiPropertyOptional({ example: '7786XXXX' })
  employeephonenumber?: string;

  @ApiPropertyOptional({ example: '35233177903C44859C82269212F48088' })
  requestid?: string;

  @ApiPropertyOptional({ example: 'error', description: 'Present on failure.' })
  status?: string;

  @ApiPropertyOptional({ example: 'Invalid employee id received.', description: 'Present on failure.' })
  message?: string;
}

/**
 * POST /auth/send-otp — standalone OTP send. Generates the OTP and stores it
 * as a row in the MOTC SMS push table (`MOTC_SMS_PushTable`) — the government
 * gateway picks pending rows up and fires the SMS from their side. The
 * returned requestid (= MessageID) is what /auth/otp/validate expects.
 */
export class SendOtpRequestDto extends ClientContextDto {
  @ApiProperty({ example: '55123456', description: 'Destination phone number (ToAddress).' })
  @IsString()
  @IsNotEmpty()
  phonenumber!: string;
}

export class SendOtpResponseDto {
  @ApiProperty({ example: 'success' })
  status!: string;

  @ApiPropertyOptional({
    example: '12345',
    description: 'Correlation id (push-table MessageID) — echo it on /auth/otp/validate.',
  })
  requestid?: string;

  @ApiPropertyOptional({ description: 'Present on failure.' })
  message?: string;
}

/** API-3 — Validate OTP request. */
export class ValidateOtpRequestDto extends ClientContextDto {
  @ApiProperty({ example: '232323' })
  @IsString()
  @IsNotEmpty()
  otp!: string;

  @ApiProperty({ example: '13131313123', description: 'Correlation id from User Validate.' })
  @IsString()
  @IsNotEmpty()
  requestid!: string;
}
