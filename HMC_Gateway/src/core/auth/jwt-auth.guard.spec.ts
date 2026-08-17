import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DEV_USER } from './auth-user.interface';

describe('JwtAuthGuard', () => {
  const makeContext = (req: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  it('allows @Public() routes without invoking passport', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const config = { get: () => false } as unknown as ConfigService;
    const guard = new JwtAuthGuard(reflector, config);

    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('injects DEV_USER and allows the request when AUTH_DISABLED=true', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const config = { get: () => true } as unknown as ConfigService;
    const guard = new JwtAuthGuard(reflector, config);
    const req: { user?: unknown } = {};

    expect(guard.canActivate(makeContext(req))).toBe(true);
    expect(req.user).toEqual(DEV_USER);
  });

  it('handleRequest returns the user when present', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const config = { get: () => false } as unknown as ConfigService;
    const guard = new JwtAuthGuard(reflector, config);
    const user = { username: 'AIBRAHIM39' };

    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException when there is no user', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const config = { get: () => false } as unknown as ConfigService;
    const guard = new JwtAuthGuard(reflector, config);

    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('handleRequest rethrows a passport error', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const config = { get: () => false } as unknown as ConfigService;
    const guard = new JwtAuthGuard(reflector, config);
    const err = new Error('token expired');

    expect(() => guard.handleRequest(err, null)).toThrow('token expired');
  });
});
