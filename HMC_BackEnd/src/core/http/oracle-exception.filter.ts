import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { OracleQueryError } from '../database/oracle.error';
import { ORA_HTTP_STATUS, ORA_NO_DATA_FOUND } from '@shared/constants/error-codes';
import { SanaadErrorEnvelope } from '@shared/interfaces/sanaad-response.interface';

/**
 * Maps Oracle `ORA-#####` / `PLS-#####` errors to HTTP + the Sanaad error
 * envelope. `ORA-01403 no data found` → 404. Raw ORA text is never returned
 * verbatim to clients in production (logged in full server-side).
 *
 * See Docs_Ai/Architecture/README.md section 6.
 */
@Catch(OracleQueryError)
export class OracleExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OracleExceptionFilter.name);

  catch(exception: OracleQueryError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url?: string; correlationId?: string }>();

    const oraCode = exception.oraCode;
    const httpStatusCode =
      (oraCode !== undefined && ORA_HTTP_STATUS[oraCode]) || HttpStatus.BAD_GATEWAY;

    this.logger.error(
      `Oracle error (ORA-${oraCode ?? '?'}) on ${req?.url ?? ''}: ${exception.message}`,
    );

    const envelope: SanaadErrorEnvelope = {
      status: 'error',
      opstatus: 1,
      errormessage:
        oraCode === ORA_NO_DATA_FOUND ? 'No data found.' : exception.message,
      httpStatusCode,
      path: req?.url,
      correlationId: req?.correlationId,
      timestamp: new Date().toISOString(),
    };

    res.status(httpStatusCode).json(envelope);
  }
}
