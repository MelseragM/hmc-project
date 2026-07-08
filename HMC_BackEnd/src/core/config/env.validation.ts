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

  // Misc
  REQUEST_TIMEOUT_MS: Joi.number().default(30000),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),
});
