import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { OracleQueryError } from '../database/oracle.error';
import { classifyException } from '../http/exception-classifier';
import { ApiLogEntry } from './api-log.model';
import { ApiLogStore } from './api-log.store';
import { ApiLogFileWriter } from './api-log-file-writer.service';
import { safePreview, topStackFrame } from './sensitive-data.util';

type RequestWithContext = Request & {
  correlationId?: string;
  user?: AuthenticatedUser;
};

/**
 * Global request/response logger — the ONLY place API traffic is logged, so no
 * controller/service needs its own logging code. Registered as the outermost
 * interceptor (see ApiLogsModule) so it observes the fully-built response (for
 * success) or the original, unsanitized exception (for failures) before the
 * global exception filter turns it into a safe client response.
 *
 * On error this only OBSERVES and logs — it always rethrows, so
 * AllExceptionsFilter remains the single place that builds the HTTP response.
 */
@Injectable()
export class ApiLogInterceptor implements NestInterceptor {
  constructor(
    private readonly store: ApiLogStore,
    private readonly fileWriter: ApiLogFileWriter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithContext>();
    const res = http.getResponse<Response>();
    const base = this.baseContext(context, req, started);

    return next.handle().pipe(
      tap((data) => {
        this.persist({
          ...base,
          statusCode: res?.statusCode ?? 200,
          responseTimeMs: Date.now() - started,
          success: true,
          responseSummary: safePreview(data),
        });
      }),
      catchError((err: unknown) => {
        const classified = classifyException(err);
        const stack = err instanceof Error ? err.stack : undefined;
        const { file, functionName } = topStackFrame(stack);
        this.persist({
          ...base,
          statusCode: classified.httpStatus,
          responseTimeMs: Date.now() - started,
          success: false,
          errorCategory: classified.category,
          errorMessage: classified.message,
          errors: classified.errors,
          originalErrorMessage: err instanceof Error ? err.message : String(err),
          stackTrace: stack,
          oraCode: err instanceof OracleQueryError ? err.oraCode : undefined,
          fileName: file,
          functionName,
        });
        return throwError(() => err);
      }),
    );
  }

  /** Fields known before the handler runs (request-side detail + routing). */
  private baseContext(context: ExecutionContext, req: RequestWithContext, started: number) {
    const handler = context.getHandler();
    const cls = context.getClass();
    return {
      id: this.store.nextId(),
      requestId: req?.correlationId ?? 'unknown',
      timestamp: new Date(started).toISOString(),
      method: req?.method ?? 'UNKNOWN',
      endpoint: req?.originalUrl ?? req?.url ?? '',
      routeTemplate: this.routeTemplate(req),
      routeParams: safePreview(req?.params) as Record<string, unknown> | undefined,
      queryParams: safePreview(req?.query) as Record<string, unknown> | undefined,
      requestBody: safePreview(req?.body),
      userId: req?.user?.employeeNumber,
      username: req?.user?.username,
      ip: req?.ip ?? req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      module: cls?.name,
      action: handler?.name,
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  private routeTemplate(req: RequestWithContext): string | undefined {
    const route = (req as unknown as { route?: { path?: string } }).route;
    if (!route?.path) return undefined;
    return `${req.baseUrl ?? ''}${route.path}`;
  }

  /** Merge base + outcome into a full ApiLogEntry, store it, and persist to disk. */
  private persist(
    partial: ReturnType<ApiLogInterceptor['baseContext']> &
      Partial<Omit<ApiLogEntry, keyof ReturnType<ApiLogInterceptor['baseContext']>>> & {
        statusCode: number;
        responseTimeMs: number;
        success: boolean;
        errors?: unknown;
      },
  ): void {
    const { errors, ...rest } = partial;
    const entry: ApiLogEntry = { ...rest, validationErrors: errors ?? rest.validationErrors };
    this.store.record(entry);
    this.fileWriter.write(entry);
  }
}
