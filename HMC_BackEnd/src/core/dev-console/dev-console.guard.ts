import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DevConsoleConfig } from '../config/configuration';

/**
 * Gate for the internal developer console. Three independent locks:
 *  1. `NODE_ENV=production` → the routes do not exist at all (404), whatever
 *     the flags say. The console can execute SQL; it must never be reachable
 *     on a production deployment.
 *  2. `DEV_CONSOLE_ENABLED` must be true (off by default) → 404 otherwise, so
 *     probing cannot even tell the feature exists.
 *  3. `DEV_CONSOLE_TOKEN`, when set, must match the `x-console-token` header
 *     or `?token=` query parameter → 403 otherwise.
 */
@Injectable()
export class DevConsoleGuard implements CanActivate {
  private readonly cfg: DevConsoleConfig;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.cfg = config.get<DevConsoleConfig>('devConsole', {
      enabled: false,
      token: '',
      allowWrite: false,
      maxRows: 500,
      timeoutMs: 60000,
    });
    this.isProduction = config.get<string>('app.nodeEnv', 'development') === 'production';
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.isProduction || !this.cfg.enabled) {
      // Same response as an unknown route: presence of the console is not leaked.
      throw new NotFoundException('Cannot GET ' + context.switchToHttp().getRequest<Request>().path);
    }
    if (!this.cfg.token) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const supplied = (req.headers['x-console-token'] as string) || (req.query?.token as string) || '';
    if (supplied !== this.cfg.token) {
      throw new ForbiddenException('Invalid console token.');
    }
    return true;
  }
}
