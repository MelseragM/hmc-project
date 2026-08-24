import * as fs from 'fs';

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
  /**
   * Per-sub-read deadline (ms) for endpoints that fan out several Oracle reads
   * in parallel (e.g. leave defaults). Kept well under `requestTimeoutMs` so one
   * slow view degrades to a partial result instead of a whole-request timeout.
   */
  aggregateReadTimeoutMs: number;
  lovCacheTtlMs: number;
  logLevel: string;
  /**
   * Identity provider for the auth journey: LDAPS, Entra ID (Graph), or the
   * legacy Users DB itself (`usersdb` — HMC_Sanad_DeviceRegn_tbl, no directory).
   */
  directory: 'ldap' | 'entra' | 'usersdb';
}

export interface OracleConfig {
  user: string;
  password: string;
  dsn: string;
  poolMin: number;
  poolMax: number;
  poolTimeout: number;
  queueTimeout: number;
  callTimeout: number;
  disabled: boolean;
  /** Use node-oracledb Thick mode (requires Oracle Client libraries at runtime). */
  thickMode: boolean;
  /** Optional path to the Oracle Client / Instant Client libraries for Thick mode. */
  libDir?: string;
}

/**
 * Internal developer console (SQL worksheet + API tester). NOT part of the
 * public API: hidden from Swagger, disabled unless explicitly enabled, and
 * refused outright when NODE_ENV=production. Read-only by default.
 */
export interface DevConsoleConfig {
  /** Master switch (DEV_CONSOLE_ENABLED). Off unless explicitly turned on. */
  enabled: boolean;
  /** Shared secret required in the `x-console-token` header / `?token=`. Empty = no token check. */
  token: string;
  /** Allow DML/DDL/PLSQL that changes data. Off = SELECT/WITH/EXPLAIN + read-only PL/SQL only. */
  allowWrite: boolean;
  /** Hard cap on rows returned by one statement. */
  maxRows: number;
  /** Per-statement Oracle call timeout (ms). */
  timeoutMs: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresIn: string;
  disabled: boolean;
  /**
   * Users-DB view/table holding the login `functionaccesslist` (module name/
   * code/status per function). The documented legacy query is
   * `SELECT FunctionName, FunctionCode, Description, StatusCode FROM
   *  HMC_Sanad_AppMaster_VW WHERE AppID = 1`; columns are resolved tolerantly
   * when that projection fails.
   */
  functionAccessView: string;
  /** AppID filter of the documented AppMaster query (Sanaad = 1). */
  functionAccessAppId: number;
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
  /** App name matched against HMC_Sanad_AppMaster_Tbl.AppName (DB-backed API-1). */
  appName: string;
}

/**
 * Users/Sanaad SQL Server database — backs the auth cycle (device registration,
 * MPIN, OTP rows) and the API-1 downtime/app-update tables. Legacy tables:
 * HMC_Sanad_DeviceRegn_tbl, HMC_RHAP_OTP_tbl, HMC_Sanad_AppDownTime_tbl, ...
 */
export interface UsersDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  poolMin: number;
  poolMax: number;
  /** Per-request timeout (ms) — mirrors ORACLE_CALL_TIMEOUT_MS convention. */
  requestTimeoutMs: number;
  connectTimeoutMs: number;
  /** TLS to the SQL Server (true unless the instance has no cert). */
  encrypt: boolean;
  /** Accept the server cert without CA validation (self-signed instances). */
  trustServerCertificate: boolean;
  disabled: boolean;
}

/**
 * SMS gateway used for OTP delivery. Generic config-driven HTTP adapter until
 * the corporate gateway contract is finalized; unset base URL = log-only in
 * non-production, hard failure in production.
 */
export interface SmsConfig {
  baseUrl: string;
  apiKey: string;
  senderId: string;
  timeoutMs: number;
  /** Message body; `{otp}` is substituted with the raw OTP at send time. */
  messageTemplate: string;
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
  /**
   * UPN domain suffix for direct binds (`username@upnDomain`), e.g. HMC.ORG.QA.
   * Defaults to `host`. Used by `authenticate()`, which binds directly as the
   * user — no service-account search needed.
   */
  upnDomain: string;
  /** Search base, e.g. DC=hmc,DC=org,DC=qa. Used by `validate()` only. */
  baseDn: string;
  /** User search filter; `{username}` is substituted at runtime. Used by `validate()` only. */
  searchFilter: string;
  /** Attribute holding the login name (e.g. sAMAccountName). Used by `validate()` only. */
  usernameAttribute: string;
  /** Service account DN used to bind before searching. Used by `validate()` only. */
  bindDn: string;
  /** Service account password. Used by `validate()` only. */
  bindPassword: string;
  /** Reject invalid/self-signed TLS certs (set true in production). */
  tlsRejectUnauthorized: boolean;
  /**
   * CA certificate(s) (PEM) to trust for LDAPS, read once at boot from
   * LDAP_CA_CERT (inline PEM) or LDAP_CA_CERT_PATH (file path) — inline wins
   * if both are set. Required to set `tlsRejectUnauthorized: true` against an
   * internal/self-signed AD CA; leave unset only for a quick connectivity
   * test (with tlsRejectUnauthorized=false).
   */
  caCert?: Buffer;
  /** Bind/search timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * Azure Entra ID (Microsoft Graph) directory lookup — the cloud replacement for
 * the LDAPS `validate()` path. App-only (client-credentials) auth; used only to
 * resolve employee identity + phone (the mobile journey stays OTP + MPIN).
 */
export interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Graph API base, e.g. https://graph.microsoft.com/v1.0. */
  graphBaseUrl: string;
  /** AAD login base for the token endpoint, e.g. https://login.microsoftonline.com. */
  loginBaseUrl: string;
  /** User property the mobile `username` maps to (default userPrincipalName). */
  lookupAttribute: string;
  /** Token + Graph request timeout in milliseconds. */
  timeoutMs: number;
}

export interface RootConfig {
  app: AppConfig;
  oracle: OracleConfig;
  devConsole: DevConsoleConfig;
  usersDb: UsersDbConfig;
  sms: SmsConfig;
  auth: AuthConfig;
  cerner: CernerConfig;
  appLaunch: AppLaunchConfig;
  mpin: MpinConfig;
  otp: OtpConfig;
  ldap: LdapConfig;
  entra: EntraConfig;
}

const toBool = (v: unknown): boolean => v === true || v === 'true';

/**
 * Resolve the LDAPS CA certificate: an inline PEM (LDAP_CA_CERT, `\n`
 * unescaped so it can be set as a single-line env var) wins over a file path
 * (LDAP_CA_CERT_PATH). Runs once at config-load time (before the Nest Logger
 * exists), so a missing/unreadable file is only ever `console.warn`'d —
 * never throws, since LDAP may be disabled or mid-provisioning.
 */
function loadLdapCaCert(): Buffer | undefined {
  const inline = process.env.LDAP_CA_CERT;
  if (inline) return Buffer.from(inline.replace(/\\n/g, '\n'), 'utf8');
  const path = process.env.LDAP_CA_CERT_PATH;
  if (!path) return undefined;
  try {
    return fs.readFileSync(path);
  } catch (err) {
    console.warn(
      `[configuration] Could not read LDAP_CA_CERT_PATH="${path}": ${(err as Error).message}`,
    );
    return undefined;
  }
}

export default (): RootConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
    gatewayBaseUrl:
      process.env.SANAAD_GATEWAY_BASE_URL ?? 'https://apigwuat.api.hamad.qa/sanaad',
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
    // Set directly for now (not env-driven). Kept under `requestTimeoutMs`.
    aggregateReadTimeoutMs: 20000,
    lovCacheTtlMs: Number(process.env.LOV_CACHE_TTL_MS ?? 300000),
    logLevel: process.env.LOG_LEVEL ?? 'debug',
    directory:
      process.env.AUTH_DIRECTORY === 'entra'
        ? 'entra'
        : process.env.AUTH_DIRECTORY === 'usersdb'
          ? 'usersdb'
          : 'ldap',
  },
  oracle: {
    user: process.env.ORACLE_USER ?? '',
    password: process.env.ORACLE_PASSWORD ?? '',
    dsn: process.env.ORACLE_DSN ?? '',
    poolMin: Number(process.env.ORACLE_POOL_MIN ?? 2),
    poolMax: Number(process.env.ORACLE_POOL_MAX ?? 10),
    poolTimeout: Number(process.env.ORACLE_POOL_TIMEOUT ?? 60),
    queueTimeout: Number(process.env.ORACLE_QUEUE_TIMEOUT_MS ?? 25000),
    callTimeout: Number(process.env.ORACLE_CALL_TIMEOUT_MS ?? 25000),
    disabled: toBool(process.env.ORACLE_DISABLED),
    thickMode: toBool(process.env.ORACLE_THICK_MODE ?? 'true'),
    libDir: process.env.ORACLE_CLIENT_LIB_DIR || undefined,
  },
  devConsole: {
    enabled: toBool(process.env.DEV_CONSOLE_ENABLED),
    token: process.env.DEV_CONSOLE_TOKEN ?? '',
    allowWrite: toBool(process.env.DEV_CONSOLE_ALLOW_WRITE),
    maxRows: Number(process.env.DEV_CONSOLE_MAX_ROWS ?? 500),
    timeoutMs: Number(process.env.DEV_CONSOLE_TIMEOUT_MS ?? 60000),
  },
  usersDb: {
    host: process.env.USERS_DB_HOST ?? '',
    port: Number(process.env.USERS_DB_PORT ?? 1433),
    database: process.env.USERS_DB_NAME ?? '',
    user: process.env.USERS_DB_USER ?? '',
    password: process.env.USERS_DB_PASSWORD ?? '',
    poolMin: Number(process.env.USERS_DB_POOL_MIN ?? 2),
    poolMax: Number(process.env.USERS_DB_POOL_MAX ?? 10),
    requestTimeoutMs: Number(process.env.USERS_DB_REQUEST_TIMEOUT_MS ?? 25000),
    connectTimeoutMs: Number(process.env.USERS_DB_CONNECT_TIMEOUT_MS ?? 15000),
    encrypt: toBool(process.env.USERS_DB_ENCRYPT ?? 'true'),
    trustServerCertificate: toBool(process.env.USERS_DB_TRUST_SERVER_CERT ?? 'false'),
    disabled: toBool(process.env.USERS_DB_DISABLED),
  },
  sms: {
    baseUrl: process.env.SMS_API_BASE_URL ?? '',
    apiKey: process.env.SMS_API_KEY ?? '',
    senderId: process.env.SMS_SENDER_ID ?? '',
    timeoutMs: Number(process.env.SMS_API_TIMEOUT_MS ?? 25000),
    messageTemplate: process.env.SMS_MESSAGE_TEMPLATE ?? 'Your Sanaad verification code is {otp}',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
    jwtIssuer: process.env.JWT_ISSUER ?? 'sanaad',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'sanaad-b2e',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    disabled: toBool(process.env.AUTH_DISABLED),
    functionAccessView: process.env.FUNCTION_ACCESS_VIEW ?? 'HMC_Sanad_AppMaster_VW',
    functionAccessAppId: Number(process.env.FUNCTION_ACCESS_APP_ID ?? 1),
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
    appName: process.env.APP_NAME ?? 'SanaadHealth',
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
    // Defaults to LDAP_HOST — override only if the UPN suffix differs from
    // the directory host (uncommon).
    upnDomain: process.env.LDAP_UPN_DOMAIN || process.env.LDAP_HOST || 'HMC.ORG.QA',
    baseDn: process.env.LDAP_BASE_DN ?? 'DC=hmc,DC=org,DC=qa',
    searchFilter: process.env.LDAP_SEARCH_FILTER ?? '(sAMAccountName={username})',
    usernameAttribute: process.env.LDAP_USERNAME_ATTRIBUTE ?? 'sAMAccountName',
    bindDn: process.env.LDAP_BIND_DN ?? '',
    bindPassword: process.env.LDAP_BIND_PASSWORD ?? '',
    tlsRejectUnauthorized: toBool(process.env.LDAP_TLS_REJECT_UNAUTHORIZED ?? 'false'),
    caCert: loadLdapCaCert(),
    timeoutMs: Number(process.env.LDAP_TIMEOUT_MS ?? 10000),
  },
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID ?? '',
    clientId: process.env.ENTRA_CLIENT_ID ?? '',
    clientSecret: process.env.ENTRA_CLIENT_SECRET ?? '',
    graphBaseUrl: process.env.ENTRA_GRAPH_BASE_URL ?? 'https://graph.microsoft.com/v1.0',
    loginBaseUrl: process.env.ENTRA_LOGIN_BASE_URL ?? 'https://login.microsoftonline.com',
    lookupAttribute: process.env.ENTRA_LOOKUP_ATTRIBUTE ?? 'userPrincipalName',
    timeoutMs: Number(process.env.ENTRA_TIMEOUT_MS ?? 10000),
  },
});
