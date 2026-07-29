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

/** App-launch health check (API-1): downtime window + forced/optional update. */
export interface AppLaunchConfig {
  minSupportedVersion: string;
  latestVersion: string;
  downtime: boolean;
  downtimeStart: string;
  downtimeEnd: string;
}

export interface MpinConfig {
  minLength: number;
  maxLength: number;
  maxAttempts: number;
  lockoutMinutes: number;
}

export interface OtpConfig {
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
  resendWindowSeconds: number;
}

export interface LdapConfig {
  url: string;
  baseDn: string;
  enabled: boolean;
}

export interface RootConfig {
  app: AppConfig;
  oracle: OracleConfig;
  auth: AuthConfig;
  cerner: CernerConfig;
  appLaunch: AppLaunchConfig;
  mpin: MpinConfig;
  otp: OtpConfig;
  ldap: LdapConfig;
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
  appLaunch: {
    minSupportedVersion: process.env.APP_MIN_SUPPORTED_VERSION ?? '1.0.0',
    latestVersion: process.env.APP_LATEST_VERSION ?? '1.0.0',
    downtime: toBool(process.env.APP_DOWNTIME),
    downtimeStart: process.env.APP_DOWNTIME_START ?? '',
    downtimeEnd: process.env.APP_DOWNTIME_END ?? '',
  },
  mpin: {
    minLength: Number(process.env.MPIN_MIN_LENGTH ?? 4),
    maxLength: Number(process.env.MPIN_MAX_LENGTH ?? 6),
    maxAttempts: Number(process.env.MPIN_MAX_ATTEMPTS ?? 5),
    lockoutMinutes: Number(process.env.MPIN_LOCKOUT_MINUTES ?? 15),
  },
  otp: {
    length: Number(process.env.OTP_LENGTH ?? 6),
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    resendWindowSeconds: Number(process.env.OTP_RESEND_WINDOW_SECONDS ?? 60),
  },
  ldap: {
    url: process.env.LDAP_URL ?? '',
    baseDn: process.env.LDAP_BASE_DN ?? '',
    enabled: toBool(process.env.LDAP_ENABLED),
  },
});
