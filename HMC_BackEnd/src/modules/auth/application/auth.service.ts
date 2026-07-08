import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '@core/config/configuration';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';

export interface TokenResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

/**
 * op 1 login is out-of-band ("Another document provided"). Until the real IdP/
 * gateway spec lands, `login` issues a DEV token (no credential verification) in
 * non-production only, so the API can be exercised end-to-end. `me` echoes the
 * verified token identity.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly nodeEnv: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.nodeEnv = config.get<string>('app.nodeEnv', 'development');
    this.expiresIn = config.getOrThrow<AuthConfig>('auth').jwtExpiresIn;
  }

  async login(username: string): Promise<TokenResult> {
    if (this.nodeEnv === 'production') {
      throw new NotImplementedException(
        'Login (op 1) is out-of-band — integrate the real IdP/gateway before production use.',
      );
    }
    this.logger.warn(
      `Issuing DEV token for "${username}" WITHOUT credential verification (op-1 spec pending).`,
    );
    const payload = { sub: username, username, roles: [Role.EMPLOYEE] };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, tokenType: 'Bearer', expiresIn: this.expiresIn };
  }

  me(user: AuthenticatedUser): AuthenticatedUser {
    // TODO: optionally enrich from PERSONAL_DETAILS_V via a UserContextRepository.
    return { username: user.username, employeeNumber: user.employeeNumber, roles: user.roles };
  }
}
