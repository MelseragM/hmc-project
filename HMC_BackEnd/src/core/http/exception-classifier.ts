import { HttpException, HttpStatus } from '@nestjs/common';
import { OracleQueryError } from '../database/oracle.error';
import { ORA_NO_DATA_FOUND } from '@shared/constants/error-codes';
import { CATEGORY_MESSAGE, CATEGORY_STATUS, ErrorCategory } from './error-category';

/** Result of classifying any thrown value into a safe, client-facing shape. */
export interface ClassifiedError {
  category: ErrorCategory;
  httpStatus: number;
  /** Safe message (already stripped of technical detail). */
  message: string;
  /** Field-level detail for validation failures only (describes client input). */
  errors?: Record<string, unknown>;
  /** True → a server fault (log with stack at error level); false → client fault (warn). */
  serverSide: boolean;
}

function of(category: ErrorCategory, overrides: Partial<ClassifiedError> = {}): ClassifiedError {
  const httpStatus = overrides.httpStatus ?? CATEGORY_STATUS[category];
  return {
    category,
    httpStatus,
    message: overrides.message ?? CATEGORY_MESSAGE[category],
    errors: overrides.errors,
    serverSide: overrides.serverSide ?? httpStatus >= 500,
  };
}

/**
 * Map any thrown value to a category + safe message + HTTP status. The mapping
 * is by TYPE (and, for Oracle, by ORA code), so services/controllers can throw
 * ordinary exceptions and never need to sanitize messages themselves.
 */
export function classifyException(exception: unknown): ClassifiedError {
  if (exception instanceof OracleQueryError) return classifyOracle(exception);
  if (exception instanceof HttpException) return classifyHttp(exception);
  // A thrown Error that isn't an HttpException is an application bug.
  if (exception instanceof Error) return of(ErrorCategory.APPLICATION_ERROR);
  // Something non-Error was thrown (string, object, …).
  return of(ErrorCategory.UNKNOWN_ERROR);
}

/** Oracle/PL-SQL errors: map a few well-known codes, everything else is a generic DB error. */
function classifyOracle(ex: OracleQueryError): ClassifiedError {
  const code = ex.oraCode;
  if (code === ORA_NO_DATA_FOUND) return of(ErrorCategory.NOT_FOUND);
  // unique/integrity constraint or a custom ORA-20xxx business raise → business rule conflict
  if (
    code === 1 ||
    code === 2290 ||
    code === 2291 ||
    code === 2292 ||
    (code! >= 20000 && code! <= 20999)
  ) {
    return of(ErrorCategory.BUSINESS_RULE);
  }
  return of(ErrorCategory.DATABASE_ERROR);
}

/** Nest HttpExceptions: category is driven by the status code. */
function classifyHttp(ex: HttpException): ClassifiedError {
  const status = ex.getStatus();
  switch (status) {
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return of(ErrorCategory.VALIDATION_ERROR, {
        httpStatus: status,
        errors: extractValidationErrors(ex),
      });
    case HttpStatus.UNAUTHORIZED:
      return of(ErrorCategory.AUTHENTICATION_ERROR);
    case HttpStatus.FORBIDDEN:
      return of(ErrorCategory.AUTHORIZATION_ERROR);
    case HttpStatus.NOT_FOUND:
      return of(ErrorCategory.NOT_FOUND);
    case HttpStatus.REQUEST_TIMEOUT:
    case HttpStatus.GATEWAY_TIMEOUT:
      return of(ErrorCategory.TIMEOUT, { httpStatus: status });
    case HttpStatus.CONFLICT:
      return of(ErrorCategory.BUSINESS_RULE);
    case HttpStatus.BAD_GATEWAY:
    case HttpStatus.SERVICE_UNAVAILABLE:
      return of(ErrorCategory.EXTERNAL_SERVICE_ERROR, { httpStatus: status });
    default:
      if (status >= 500) return of(ErrorCategory.APPLICATION_ERROR, { httpStatus: status });
      // Any other 4xx: a client-side rule violation, message kept generic.
      return of(ErrorCategory.BUSINESS_RULE, { httpStatus: status });
  }
}

/**
 * Pull class-validator messages out of a BadRequestException into a safe
 * `errors` object. These describe the caller's OWN input, so they carry no
 * internal detail.
 */
function extractValidationErrors(ex: HttpException): Record<string, unknown> | undefined {
  const response = ex.getResponse();
  if (typeof response !== 'object' || response === null) return undefined;
  const raw = (response as { message?: string | string[] }).message;
  const details = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return details.length ? { details } : undefined;
}
