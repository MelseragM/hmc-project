import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface RequestLike {
  url?: string;
  method?: string;
  correlationId?: string;
}

/**
 * Global exception filter for gateway-originated errors (auth failures,
 * throttling, and — most importantly — proxy failures when HMC_BackEnd is
 * unreachable/times out). Returns a deliberately minimal envelope; the
 * gateway is not the source of truth for HMC_BackEnd's full SanaadEnvelope
 * error shape, so it does not attempt to reproduce it here. Responses that
 * originate FROM the backend are streamed through by ProxyService untouched
 * and never reach this filter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestLike>();

    const httpStatus =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.resolveMessage(exception, httpStatus);

    const line = `${httpStatus} ${req?.method ?? ''} ${req?.url ?? ''} cid=${req?.correlationId ?? '-'} :: ${message}`;
    if (httpStatus >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(line);
    }

    res.status(httpStatus).json({
      status: 'error',
      message,
      httpStatusCode: httpStatus,
    });
  }

  private resolveMessage(exception: unknown, httpStatus: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const msg = (response as { message: unknown }).message;
        return Array.isArray(msg) ? msg.join('; ') : String(msg);
      }
      return exception.message;
    }
    return httpStatus === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : exception instanceof Error
        ? exception.message
        : 'Unknown error';
  }
}
