/**
 * Error taxonomy for the centralized exception handler. Each category maps to a
 * safe, client-facing message and a default HTTP status. Technical detail
 * (ORA codes, SQL, schema, stack traces, internal messages) is NEVER put in the
 * `message` — it is only logged server-side by the global filter.
 */
export enum ErrorCategory {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BUSINESS_RULE = 'BUSINESS_RULE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  APPLICATION_ERROR = 'APPLICATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/** Safe, high-level message shown to clients per category. */
export const CATEGORY_MESSAGE: Readonly<Record<ErrorCategory, string>> = Object.freeze({
  [ErrorCategory.VALIDATION_ERROR]: 'Validation failed.',
  [ErrorCategory.AUTHENTICATION_ERROR]: 'Authentication failed.',
  [ErrorCategory.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
  [ErrorCategory.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCategory.BUSINESS_RULE]: 'The requested operation cannot be completed.',
  [ErrorCategory.DATABASE_ERROR]:
    'A database operation could not be completed. Please contact support if the problem persists.',
  [ErrorCategory.EXTERNAL_SERVICE_ERROR]: 'An external service is currently unavailable.',
  [ErrorCategory.TIMEOUT]: 'The request took too long to process. Please try again.',
  [ErrorCategory.APPLICATION_ERROR]: 'An unexpected application error occurred.',
  [ErrorCategory.UNKNOWN_ERROR]: 'An unexpected error occurred.',
});

/** Default HTTP status per category (a concrete HttpException status wins over this). */
export const CATEGORY_STATUS: Readonly<Record<ErrorCategory, number>> = Object.freeze({
  [ErrorCategory.VALIDATION_ERROR]: 400,
  [ErrorCategory.AUTHENTICATION_ERROR]: 401,
  [ErrorCategory.AUTHORIZATION_ERROR]: 403,
  [ErrorCategory.NOT_FOUND]: 404,
  [ErrorCategory.BUSINESS_RULE]: 409,
  [ErrorCategory.DATABASE_ERROR]: 500,
  [ErrorCategory.EXTERNAL_SERVICE_ERROR]: 503,
  [ErrorCategory.TIMEOUT]: 408,
  [ErrorCategory.APPLICATION_ERROR]: 500,
  [ErrorCategory.UNKNOWN_ERROR]: 500,
});

/**
 * Markers of technical/internal detail that must never reach a client: Oracle /
 * PL/SQL codes, SQL keywords, schema object names, connection strings, file
 * paths and stack frames.
 */
const SENSITIVE_PATTERN =
  /(ORA-\d{3,5}|PLS-\d{3,5}|\bSELECT\b|\bFROM\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bBEGIN\b|XXHMC_[A-Z0-9_.]+|connectString|:\d+\/[A-Za-z0-9_]+|[A-Za-z]:\\|\/(?:home|Users|var|opt|app)\/|node_modules|\.(?:ts|js):\d+|\n\s*at\s)/i;

/** True when `text` contains internal detail that must not be exposed to clients. */
export function looksSensitive(text?: string | null): boolean {
  return !!text && SENSITIVE_PATTERN.test(text);
}
