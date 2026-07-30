import * as Joi from 'joi';

/**
 * Env schema — fails fast at boot if configuration is missing/invalid.
 * See .env.example for the full list.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('*'),

  SANAAD_GATEWAY_BASE_URL: Joi.string()
    .uri()
    .default('https://apigwuat.api.hamad.qa/sanaad'),

  // Oracle
  ORACLE_USER: Joi.string().allow('').default(''),
  ORACLE_PASSWORD: Joi.string().allow('').default(''),
  ORACLE_DSN: Joi.string().allow('').default(''),
  ORACLE_POOL_MIN: Joi.number().default(2),
  ORACLE_POOL_MAX: Joi.number().default(10),
  ORACLE_POOL_TIMEOUT: Joi.number().default(60),
  ORACLE_DISABLED: Joi.boolean().default(false),

  // Auth
  JWT_SECRET: Joi.string().min(8).default('dev-only-secret-change-me'),
  JWT_ISSUER: Joi.string().default('sanaad'),
  JWT_AUDIENCE: Joi.string().default('sanaad-b2e'),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  AUTH_DISABLED: Joi.boolean().default(false),

  // Cerner
  CERNER_BASE_URL: Joi.string().uri().allow('').default(''),
  CERNER_TIMEOUT_MS: Joi.number().default(10000),

  // Auth framework — app-launch (API-1)
  APP_MIN_SUPPORTED_VERSION: Joi.string().default('1.0.0'),
  APP_LATEST_VERSION: Joi.string().default('1.0.0'),
  APP_DOWNTIME: Joi.boolean().default(false),
  APP_DOWNTIME_START: Joi.string().allow('').default(''),
  APP_DOWNTIME_END: Joi.string().allow('').default(''),

  // Auth framework — MPIN policy
  MPIN_MIN_LENGTH: Joi.number().default(4),
  MPIN_MAX_LENGTH: Joi.number().default(6),
  MPIN_MAX_ATTEMPTS: Joi.number().default(5),
  MPIN_LOCKOUT_MINUTES: Joi.number().default(15),

  // Auth framework — OTP policy
  OTP_LENGTH: Joi.number().default(6),
  OTP_TTL_SECONDS: Joi.number().default(300),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
  OTP_RESEND_WINDOW_SECONDS: Joi.number().default(60),

  // Auth framework — LDAP directory (corporate Active Directory)
  LDAP_ENABLED: Joi.boolean().default(false),
  LDAP_HOST: Joi.string().allow('').default('HMC.ORG.QA'),
  LDAP_PORT: Joi.number().default(636),
  LDAP_USE_SSL: Joi.boolean().default(true),
  LDAP_URL: Joi.string().allow('').default(''),
  LDAP_BASE_DN: Joi.string().allow('').default('DC=hmc,DC=org,DC=qa'),
  LDAP_SEARCH_FILTER: Joi.string().allow('').default('(sAMAccountName={username})'),
  LDAP_USERNAME_ATTRIBUTE: Joi.string().allow('').default('sAMAccountName'),
  LDAP_BIND_DN: Joi.string().allow('').default(''),
  LDAP_BIND_PASSWORD: Joi.string().allow('').default(''),
  LDAP_TLS_REJECT_UNAUTHORIZED: Joi.boolean().default(false),
  LDAP_TIMEOUT_MS: Joi.number().default(10000),

  // Misc
  REQUEST_TIMEOUT_MS: Joi.number().default(30000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),
});
