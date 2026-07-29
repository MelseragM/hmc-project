import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { OracleModule } from './database/oracle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AllExceptionsFilter } from './http/all-exceptions.filter';
import { OracleExceptionFilter } from './http/oracle-exception.filter';
import { ResponseInterceptor } from './http/response.interceptor';
import { LoggingInterceptor } from './http/logging.interceptor';
import { TimeoutInterceptor } from './http/timeout.interceptor';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware';
import { HealthController } from './health/health.controller';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { FunctionAccessGuard } from './auth/function-access.guard';

/**
 * Framework-level cross-cutting concerns wired once for the whole app:
 * validated config, Oracle pool, auth, global pipe/guards/interceptors/filters,
 * and the correlation-id middleware.
 *
 * Filter precedence: OracleExceptionFilter is declared LAST so it takes
 * precedence over the catch-all AllExceptionsFilter for OracleQueryError.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    EventEmitterModule.forRoot(),
    OracleModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FunctionAccessGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: OracleExceptionFilter },
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
