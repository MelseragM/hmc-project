import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { SanaadErrorEnvelope } from '@shared/interfaces/sanaad-response.interface';
import { ERROR_MESSAGES } from '@shared/constants/error-codes';

/**
 * Catch-all filter (HttpException + unknown errors) → Sanaad error envelope.
 * OracleQueryError is handled by the more specific OracleExceptionFilter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url?: string; correlationId?: string }>();

    let httpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errormessage: string = ERROR_MESSAGES.UNEXPECTED;

    if (exception instanceof HttpException) {
      httpStatusCode = exception.getStatus();
      const response = exception.getResponse();
      errormessage = this.extractMessage(response) ?? exception.message;
    } else if (exception instanceof Error) {
      errormessage = exception.message;
    }

    if (httpStatusCode >= 500) {
      this.logger.error(
        `Unhandled error on ${req?.url ?? ''}: ${errormessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${httpStatusCode} on ${req?.url ?? ''}: ${errormessage}`);
    }

    const envelope: SanaadErrorEnvelope = {
      status: 'error',
      opstatus: 1,
      errormessage,
      httpStatusCode,
      path: req?.url,
      correlationId: req?.correlationId,
      timestamp: new Date().toISOString(),
    };

    res.status(httpStatusCode).json(envelope);
  }

  private extractMessage(response: string | object): string | undefined {
    if (typeof response === 'string') return response;
    const msg = (response as { message?: string | string[] }).message;
    if (Array.isArray(msg)) return msg.join('; ');
    return msg;
  }
}
