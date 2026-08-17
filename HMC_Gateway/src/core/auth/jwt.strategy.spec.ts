import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { Role } from './auth-user.interface';

describe('JwtStrategy', () => {
  const makeStrategy = () => {
    const config = {
      getOrThrow: () => ({
        jwtSecret: 'test-secret',
        jwtIssuer: 'sanaad',
        jwtAudience: 'sanaad-b2e',
        jwtExpiresIn: '1h',
        disabled: false,
      }),
    } as unknown as ConfigService;
    return new JwtStrategy(config);
  };

  it('maps a full payload to AuthenticatedUser', () => {
    const strategy = makeStrategy();
    const user = strategy.validate({
      username: 'AIBRAHIM39',
      employeeNumber: '037400',
      roles: [Role.SUPERVISOR],
      functions: ['LEAVE'],
      name: 'Ahmed Ibrahim',
      dept: 'IT',
      company: 'HMC',
    });

    expect(user).toEqual({
      username: 'AIBRAHIM39',
      employeeNumber: '037400',
      roles: [Role.SUPERVISOR],
      functions: ['LEAVE'],
      employeeName: 'Ahmed Ibrahim',
      department: 'IT',
      company: 'HMC',
      claims: expect.objectContaining({ username: 'AIBRAHIM39' }),
    });
  });

  it('falls back to sub/enum and default EMPLOYEE role when claims are sparse', () => {
    const strategy = makeStrategy();
    const user = strategy.validate({ sub: '000001', enum: '000001' });

    expect(user.username).toBe('000001');
    expect(user.employeeNumber).toBe('000001');
    expect(user.roles).toEqual([Role.EMPLOYEE]);
  });
});
