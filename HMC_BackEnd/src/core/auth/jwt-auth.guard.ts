import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { AuthenticatedUser, DEV_USER } from './auth-user.interface';
import { ERROR_MESSAGES } from '@shared/constants/error-codes';

/**
 * Global bearer guard. Skips @Public() routes. When AUTH_DISABLED=true it
 * injects a permissive DEV_USER so local development works without the (pending)
 * auth spec.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly authDisabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    super();
    this.authDisabled = config.get<boolean>('auth.disabled', false);
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (this.authDisabled) {
      const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
      req.user = req.user ?? DEV_USER;
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException(ERROR_MESSAGES.UNAUTHENTICATED);
    }
    return user;
  }
}
