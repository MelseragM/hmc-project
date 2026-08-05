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
  /** Use node-oracledb Thick mode (requires Oracle Client libraries at runtime). */
  thickMode: boolean;
  /** Optional path to the Oracle Client / Instant Client libraries for Thick mode. */
  libDir?: string;
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
  enabled: boolean;
  /** Directory host, e.g. HMC.ORG.QA. */
  host: string;
  /** Directory port (636 = LDAPS, 389 = plain LDAP). */
  port: number;
  /** Use LDAPS (SSL) — true for port 636. */
  useSsl: boolean;
  /** Connection URL; derived from host/port/useSsl when LDAP_URL is unset. */
  url: string;
  /** Search base, e.g. DC=hmc,DC=org,DC=qa. */
  baseDn: string;
  /** User search filter; `{username}` is substituted at runtime. */
  searchFilter: string;
  /** Attribute holding the login name (e.g. sAMAccountName). */
  usernameAttribute: string;
  /** Service account DN used to bind before searching. */
  bindDn: string;
  /** Service account password. */
  bindPassword: string;
  /** Reject invalid/self-signed TLS certs (set true in production). */
  tlsRejectUnauthorized: boolean;
  /** Bind/search timeout in milliseconds. */
  timeoutMs: number;
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
    thickMode: toBool(process.env.ORACLE_THICK_MODE ?? 'true'),
    libDir: process.env.ORACLE_CLIENT_LIB_DIR || undefined,
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
    enabled: toBool(process.env.LDAP_ENABLED),
    host: process.env.LDAP_HOST ?? 'HMC.ORG.QA',
    port: Number(process.env.LDAP_PORT ?? 636),
    useSsl: toBool(process.env.LDAP_USE_SSL ?? 'true'),
    // Use the explicit URL when provided; an empty/unset value derives it from
    // host/port/ssl (matters in Docker where LDAP_URL is passed as "" by default).
    url:
      process.env.LDAP_URL ||
      `${toBool(process.env.LDAP_USE_SSL ?? 'true') ? 'ldaps' : 'ldap'}://${
        process.env.LDAP_HOST ?? 'HMC.ORG.QA'
      }:${Number(process.env.LDAP_PORT ?? 636)}`,
    baseDn: process.env.LDAP_BASE_DN ?? 'DC=hmc,DC=org,DC=qa',
    searchFilter: process.env.LDAP_SEARCH_FILTER ?? '(sAMAccountName={username})',
    usernameAttribute: process.env.LDAP_USERNAME_ATTRIBUTE ?? 'sAMAccountName',
    bindDn: process.env.LDAP_BIND_DN ?? '',
    bindPassword: process.env.LDAP_BIND_PASSWORD ?? '',
    tlsRejectUnauthorized: toBool(process.env.LDAP_TLS_REJECT_UNAUTHORIZED ?? 'false'),
    timeoutMs: Number(process.env.LDAP_TIMEOUT_MS ?? 10000),
  },
});
