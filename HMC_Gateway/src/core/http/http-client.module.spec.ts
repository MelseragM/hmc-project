import { BackendConfig } from '../config/configuration';
import { buildBackendHttpsAgent } from './http-client.module';

const base: BackendConfig = {
  baseUrl: 'https://backend.hamad.qa',
  apiPrefix: 'api/v1',
  timeoutMs: 30000,
  tlsRejectUnauthorized: true,
  caCert: undefined,
};

describe('buildBackendHttpsAgent', () => {
  it('returns no agent for a plain http:// backend', () => {
    expect(buildBackendHttpsAgent({ ...base, baseUrl: 'http://localhost:3009' })).toBeUndefined();
    expect(
      buildBackendHttpsAgent({
        ...base,
        baseUrl: 'http://localhost:3009',
        tlsRejectUnauthorized: false,
      }),
    ).toBeUndefined();
  });

  it('returns no agent for https with default validation (Node trust store)', () => {
    expect(buildBackendHttpsAgent(base)).toBeUndefined();
  });

  it('disables certificate validation when tlsRejectUnauthorized=false', () => {
    const agent = buildBackendHttpsAgent({ ...base, tlsRejectUnauthorized: false });
    expect(agent).toBeDefined();
    expect(agent!.options.rejectUnauthorized).toBe(false);
  });

  it('trusts the provided CA and keeps validation on', () => {
    const ca = Buffer.from('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n');
    const agent = buildBackendHttpsAgent({ ...base, caCert: ca });
    expect(agent).toBeDefined();
    expect(agent!.options.rejectUnauthorized).toBe(true);
    expect(agent!.options.ca).toBe(ca);
  });

  it('trust-all wins over a configured CA (validation explicitly disabled)', () => {
    const ca = Buffer.from('cert');
    const agent = buildBackendHttpsAgent({ ...base, tlsRejectUnauthorized: false, caCert: ca });
    expect(agent!.options.rejectUnauthorized).toBe(false);
  });
});
