import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../config/configuration';
import { AuthenticatedUser, Role } from './auth-user.interface';

interface JwtPayload {
  sub?: string;
  username?: string;
  employeeNumber?: string;
  enum?: string;
  roles?: Role[];
  functions?: string[];
  name?: string;
  dept?: string;
  company?: string;
  [key: string]: unknown;
}

/**
 * Verifies the bearer JWT and maps claims → AuthenticatedUser.
 * NOTE: op-1 login is out-of-band; issuer/audience checks are intentionally
 * relaxed until the auth spec lands (see Docs_Ai README known gaps).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const auth = config.getOrThrow<AuthConfig>('auth');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.jwtSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      username: payload.username ?? payload.sub ?? 'unknown',
      employeeNumber: payload.employeeNumber ?? payload.enum ?? payload.sub,
      roles: payload.roles ?? [Role.EMPLOYEE],
      functions: payload.functions,
      employeeName: payload.name,
      department: payload.dept,
      company: payload.company,
      claims: payload,
    };
  }
}
