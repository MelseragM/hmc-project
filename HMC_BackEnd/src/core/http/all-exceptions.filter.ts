import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Response } from 'express';
import { SanaadErrorEnvelope } from '@shared/interfaces/sanaad-response.interface';
import { OracleQueryError } from '../database/oracle.error';
import { classifyException } from './exception-classifier';

interface RequestLike {
  url?: string;
  method?: string;
  correlationId?: string;
  user?: { username?: string; employeeNumber?: string };
}

/**
 * Global exception filter — the single place errors become HTTP responses.
 *
 * It classifies EVERY thrown value (Oracle errors, Nest HttpExceptions, plain
 * bugs) into a safe category + message and returns a consistent envelope. No
 * technical detail (ORA codes, SQL, schema, stack traces, internal messages)
 * ever reaches the client; the full exception is logged server-side instead.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestLike>();

    const classified = classifyException(exception);
    this.logInternal(exception, classified, req);

    const body: SanaadErrorEnvelope = {
      success: false,
      message: classified.message,
      category: classified.category,
      ...(classified.errors ? { errors: classified.errors } : {}),
      httpStatusCode: classified.httpStatus,
      correlationId: req?.correlationId,
      timestamp: new Date().toISOString(),
      path: req?.url,
      // Backward-compatible fields — same safe message, never raw detail.
      status: 'error',
      opstatus: 1,
      errormessage: classified.message,
    };

    res.status(classified.httpStatus).json(body);
  }

  /**
   * Log the COMPLETE exception for developers: original message, stack, ORA
   * code, request URL/method, authenticated user, correlation id (timestamp is
   * added by the logger). 5xx → error (with stack); 4xx → warn.
   */
  private logInternal(
    exception: unknown,
    classified: ReturnType<typeof classifyException>,
    req: RequestLike,
  ): void {
    const detail = {
      category: classified.category,
      httpStatus: classified.httpStatus,
      method: req?.method,
      url: req?.url,
      user: req?.user?.username ?? req?.user?.employeeNumber ?? 'anonymous',
      correlationId: req?.correlationId ?? '-',
      oraCode: exception instanceof OracleQueryError ? exception.oraCode : undefined,
      originalMessage: exception instanceof Error ? exception.message : String(exception),
    };
    const line =
      `${classified.category} ${classified.httpStatus} ${detail.method ?? ''} ${detail.url ?? ''} ` +
      `user=${detail.user} cid=${detail.correlationId}` +
      `${detail.oraCode ? ` ORA-${detail.oraCode}` : ''} :: ${detail.originalMessage}`;

    if (classified.serverSide) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(line);
    }
  }
}
