import * as fs from 'fs';

/**
 * Typed configuration factory consumed via `ConfigService`.
 * Grouped into namespaces (app, backend, auth, throttle).
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  requestTimeoutMs: number;
  logLevel: string;
}

/** The upstream HMC_BackEnd this gateway forwards every request to. */
export interface BackendConfig {
  baseUrl: string;
  apiPrefix: string;
  timeoutMs: number;
  /**
   * Reject invalid/self-signed TLS certs on an https:// backend. Set false
   * ONLY for an internal backend whose CA can't be provided (the Node
   * equivalent of .NET's trust-all ServerCertificateValidationCallback);
   * prefer keeping this true and supplying `caCert` instead.
   */
  tlsRejectUnauthorized: boolean;
  /**
   * CA certificate(s) (PEM) to trust for the backend's HTTPS endpoint, read
   * once at boot from BACKEND_CA_CERT (inline PEM) or BACKEND_CA_CERT_PATH
   * (file path) — inline wins if both are set. Lets the gateway validate an
   * internal/self-signed cert properly instead of disabling validation.
   */
  caCert?: Buffer;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresIn: string;
  disabled: boolean;
}

/** Rate limiting applied to the sensitive pre-login auth endpoints. */
export interface ThrottleConfig {
  loginLimit: number;
  loginTtlMs: number;
}

export interface RootConfig {
  app: AppConfig;
  backend: BackendConfig;
  auth: AuthConfig;
  throttle: ThrottleConfig;
}

const toBool = (v: unknown): boolean => v === true || v === 'true';

/**
 * Resolve the backend CA certificate: an inline PEM (BACKEND_CA_CERT, `\n`
 * unescaped so it can be set as a single-line env var) wins over a file path
 * (BACKEND_CA_CERT_PATH). Runs once at config-load time (before the Nest
 * Logger exists), so a missing/unreadable file is only ever `console.warn`'d —
 * never throws, since the backend may be plain http. Mirrors the LDAP CA
 * handling in HMC_BackEnd.
 */
function loadBackendCaCert(): Buffer | undefined {
  const inline = process.env.BACKEND_CA_CERT;
  if (inline) return Buffer.from(inline.replace(/\\n/g, '\n'), 'utf8');
  const path = process.env.BACKEND_CA_CERT_PATH;
  if (!path) return undefined;
  try {
    return fs.readFileSync(path);
  } catch (err) {
    console.warn(
      `[configuration] Could not read BACKEND_CA_CERT_PATH="${path}": ${(err as Error).message}`,
    );
    return undefined;
  }
}

export default (): RootConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.GATEWAY_PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 35000),
    logLevel: process.env.LOG_LEVEL ?? 'debug',
  },
  backend: {
    baseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:3009',
    apiPrefix: process.env.BACKEND_API_PREFIX ?? 'api/v1',
    timeoutMs: Number(process.env.BACKEND_TIMEOUT_MS ?? 30000),
    tlsRejectUnauthorized: toBool(process.env.BACKEND_TLS_REJECT_UNAUTHORIZED ?? 'true'),
    caCert: loadBackendCaCert(),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
    jwtIssuer: process.env.JWT_ISSUER ?? 'sanaad',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'sanaad-b2e',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    disabled: toBool(process.env.AUTH_DISABLED),
  },
  throttle: {
    loginLimit: Number(process.env.THROTTLE_LOGIN_LIMIT ?? 5),
    loginTtlMs: Number(process.env.THROTTLE_LOGIN_TTL_MS ?? 60000),
  },
});
