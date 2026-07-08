/**
 * Typed configuration factory consumed via `ConfigService`.
 * Grouped into namespaces (app, oracle, auth, cerner).
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  gatewayBaseUrl: string;
  requestTimeoutMs: number;
  logLevel: string;
}

export interface OracleConfig {
  user: string;
  password: string;
  dsn: string;
  poolMin: number;
  poolMax: number;
  poolTimeout: number;
  disabled: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresIn: string;
  disabled: boolean;
}

export interface CernerConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface RootConfig {
  app: AppConfig;
  oracle: OracleConfig;
  auth: AuthConfig;
  cerner: CernerConfig;
}

const toBool = (v: unknown): boolean => v === true || v === 'true';

export default (): RootConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
    gatewayBaseUrl:
      process.env.SANAAD_GATEWAY_BASE_URL ?? 'https://apigwuat.api.hamad.qa/sanaad',
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
    logLevel: process.env.LOG_LEVEL ?? 'debug',
  },
  oracle: {
    user: process.env.ORACLE_USER ?? '',
    password: process.env.ORACLE_PASSWORD ?? '',
    dsn: process.env.ORACLE_DSN ?? '',
    poolMin: Number(process.env.ORACLE_POOL_MIN ?? 2),
    poolMax: Number(process.env.ORACLE_POOL_MAX ?? 10),
    poolTimeout: Number(process.env.ORACLE_POOL_TIMEOUT ?? 60),
    disabled: toBool(process.env.ORACLE_DISABLED),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
    jwtIssuer: process.env.JWT_ISSUER ?? 'sanaad',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'sanaad-b2e',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    disabled: toBool(process.env.AUTH_DISABLED),
  },
  cerner: {
    baseUrl: process.env.CERNER_BASE_URL ?? '',
    timeoutMs: Number(process.env.CERNER_TIMEOUT_MS ?? 10000),
  },
});
