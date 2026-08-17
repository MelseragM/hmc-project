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
 * Verifies the bearer JWT issued by HMC_BackEnd's /auth/login (API-5) and
 * maps claims → AuthenticatedUser. Deliberately mirrors HMC_BackEnd's
 * JwtStrategy so a token minted there verifies identically here — the
 * gateway never issues tokens, only validates them locally (shared
 * JWT_SECRET/JWT_ISSUER/JWT_AUDIENCE) so no round trip to the backend is
 * needed per request.
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
