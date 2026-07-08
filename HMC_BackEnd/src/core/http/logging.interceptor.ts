import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Structured request logging: method, path, duration, user, correlation id. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      correlationId?: string;
      user?: { username?: string };
    }>();
    const started = Date.now();
    const { method, url } = req;
    const user = req.user?.username ?? 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(`${method} ${url} ${ms}ms user=${user} cid=${req.correlationId ?? '-'}`);
        },
        error: (err: Error) => {
          const ms = Date.now() - started;
          this.logger.warn(
            `${method} ${url} ${ms}ms user=${user} cid=${req.correlationId ?? '-'} error=${err.message}`,
          );
        },
      }),
    );
  }
}
