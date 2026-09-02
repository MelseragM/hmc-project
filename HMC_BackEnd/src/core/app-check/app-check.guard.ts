import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { App } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { AppCheckConfig, FirebaseConfig } from '../config/configuration';
import { FIREBASE_APP } from '../firebase/firebase-app';
import { SKIP_APP_CHECK_KEY } from './skip-app-check.decorator';

/** Header the Firebase client SDKs send on both platforms. */
export const APP_CHECK_HEADER = 'x-firebase-appcheck';

/**
 * Verifies that a request came from a genuine build of the Sanaad app.
 *
 * App Check wraps Play Integrity on Android and App Attest on iOS, so one
 * verification covers both platforms — the alternative, verifying Apple's
 * attestation objects and Google's integrity verdicts separately, is weeks of
 * key handling for the same answer.
 *
 * This complements authentication rather than replacing it: the JWT says WHO
 * is calling, App Check says WHAT is calling. A stolen token replayed from a
 * script fails here even though it is a perfectly valid token.
 *
 * ## Why the default is `off`
 *
 * Enforcement rejects real devices: no Play Services, rooted, sideloaded, an
 * emulator without a registered debug token. Turning it straight on would lock
 * those users out of the app with no warning. `observe` reports exactly what
 * WOULD have been rejected while letting everything through — run it for a
 * release cycle and read the numbers before switching to `enforce`.
 */
@Injectable()
export class AppCheckGuard implements CanActivate {
  private static readonly log = new Logger(AppCheckGuard.name);
  private readonly cfg: AppCheckConfig;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
    @Optional() @Inject(FIREBASE_APP) private readonly app?: App,
  ) {
    this.cfg = config.getOrThrow<FirebaseConfig>('firebase').appCheck;

    if (this.cfg.mode !== 'off' && !this.app) {
      // Say so loudly: the deployment asked for App Check and cannot do it.
      AppCheckGuard.log.error(
        `APP_CHECK_MODE=${this.cfg.mode} but no Firebase credential is configured — ` +
          'App Check cannot run and every request will be allowed through.',
      );
    } else if (this.cfg.mode !== 'off') {
      AppCheckGuard.log.log(`App Check is ${this.cfg.mode}.`);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.cfg.mode === 'off' || !this.app) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_APP_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      url?: string;
    }>();
    const token = req.headers[APP_CHECK_HEADER];
    const route = req.url ?? '';

    if (!token) return this.reject(route, 'no App Check token');

    try {
      const { appId } = await getAppCheck(this.app).verifyToken(token);
      // Only meaningful when the Firebase project hosts more than one app;
      // App Check already refuses tokens minted outside the project.
      if (this.cfg.allowedAppIds.length && !this.cfg.allowedAppIds.includes(appId)) {
        return this.reject(route, `app ${appId} is not allowed`);
      }
      return true;
    } catch (err) {
      return this.reject(route, (err as Error).message);
    }
  }

  /** Enforce → 401. Observe → log what would have happened and allow. */
  private reject(route: string, reason: string): boolean {
    if (this.cfg.mode === 'observe') {
      AppCheckGuard.log.warn(`App Check (observe) would reject ${route}: ${reason}`);
      return true;
    }
    AppCheckGuard.log.warn(`App Check rejected ${route}: ${reason}`);
    throw new UnauthorizedException('This request did not come from a verified app.');
  }
}
