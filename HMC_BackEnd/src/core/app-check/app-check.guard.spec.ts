import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { App } from 'firebase-admin/app';
import { AppCheckGuard, APP_CHECK_HEADER } from './app-check.guard';
import { AppCheckMode } from '../config/configuration';
import { SKIP_APP_CHECK_KEY } from './skip-app-check.decorator';

const verifyToken = jest.fn();
jest.mock('firebase-admin/app-check', () => ({
  getAppCheck: () => ({ verifyToken: (t: string) => verifyToken(t) }),
}));

/**
 * App Check answers "is this our app calling", next to the JWT's "who is
 * calling". Enforcement rejects real devices — no Play Services, rooted,
 * sideloaded, an emulator without a registered debug token — so the rollout is
 * staged: `off`, then `observe` (report only), then `enforce`. These cases pin
 * that staging, because getting it wrong locks users out of the app.
 */
describe('AppCheckGuard', () => {
  beforeEach(() => verifyToken.mockReset());

  function make(mode: AppCheckMode, opts: { app?: boolean; allowedAppIds?: string[] } = {}) {
    const config = {
      getOrThrow: () => ({
        appCheck: { mode, allowedAppIds: opts.allowedAppIds ?? [] },
      }),
    } as unknown as ConfigService;
    const app = opts.app === false ? undefined : ({} as App);
    return new AppCheckGuard(new Reflector(), config, app);
  }

  function context(token?: string, skip = false): ExecutionContext {
    const handler = () => undefined;
    class Controller {}
    if (skip) Reflect.defineMetadata(SKIP_APP_CHECK_KEY, true, handler);
    return {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: token ? { [APP_CHECK_HEADER]: token } : {},
          url: '/api/v1/leave/apply',
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('off — the default', () => {
    it('lets everything through without calling Firebase', async () => {
      await expect(make('off').canActivate(context())).resolves.toBe(true);
      expect(verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('observe', () => {
    it('allows a request with no token, so nobody is locked out while measuring', async () => {
      await expect(make('observe').canActivate(context())).resolves.toBe(true);
    });

    it('allows an invalid token too', async () => {
      verifyToken.mockRejectedValue(new Error('token expired'));

      await expect(make('observe').canActivate(context('bad'))).resolves.toBe(true);
    });

    it('still verifies, so the logs report what enforcing would cost', async () => {
      verifyToken.mockResolvedValue({ appId: '1:924:android:x' });

      await make('observe').canActivate(context('good'));

      expect(verifyToken).toHaveBeenCalledWith('good');
    });
  });

  describe('enforce', () => {
    it('accepts a valid token', async () => {
      verifyToken.mockResolvedValue({ appId: '1:924:android:x' });

      await expect(make('enforce').canActivate(context('good'))).resolves.toBe(true);
    });

    it('rejects a missing token', async () => {
      await expect(make('enforce').canActivate(context())).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an invalid one', async () => {
      verifyToken.mockRejectedValue(new Error('invalid signature'));

      await expect(make('enforce').canActivate(context('bad'))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an app id outside the allow-list', async () => {
      verifyToken.mockResolvedValue({ appId: '1:924:android:other' });
      const guard = make('enforce', { allowedAppIds: ['1:924:android:ours'] });

      await expect(guard.canActivate(context('good'))).rejects.toThrow(UnauthorizedException);
    });

    it('accepts any app in the project when no allow-list is set', async () => {
      verifyToken.mockResolvedValue({ appId: '1:924:ios:anything' });

      await expect(make('enforce').canActivate(context('good'))).resolves.toBe(true);
    });

    it('exempts a route marked @SkipAppCheck — probes and consoles are not the app', async () => {
      await expect(make('enforce').canActivate(context(undefined, true))).resolves.toBe(true);
    });

    it('allows everything when asked to enforce without a credential, rather than closing the API', async () => {
      const guard = make('enforce', { app: false });

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });
  });
});
