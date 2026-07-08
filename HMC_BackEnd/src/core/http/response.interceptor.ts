import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isSubmitResult } from '@shared/domain/submit-result';
import { SanaadEnvelope } from '@shared/interfaces/sanaad-response.interface';

/** Routes decorated with @SkipEnvelope() return their payload unwrapped (e.g. binary payslip). */
export const SKIP_ENVELOPE = 'skipEnvelope';
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE, true);

/**
 * Standardizes success responses into the Sanaad envelope. Action results
 * (SubmitResult from `_PR`/`_PKG`) get the action envelope; everything else the
 * read envelope. See Docs_Ai/Architecture/README.md section 4.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<unknown, SanaadEnvelope | unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<SanaadEnvelope | unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);

    const res = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((data): SanaadEnvelope | unknown => {
        if (skip) return data;
        const httpStatusCode = res?.statusCode ?? 200;

        if (isSubmitResult(data)) {
          return {
            status: data.status,
            successflag: data.successflag,
            errormessage: data.errormessage,
            errormessageAr: data.errormessageAr,
            httpStatusCode,
            result: data.result,
          };
        }

        return { result: data, opstatus: 0 as const, status: 'success' as const, httpStatusCode };
      }),
    );
  }
}
