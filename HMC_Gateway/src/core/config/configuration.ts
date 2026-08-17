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
