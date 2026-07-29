import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AUDIT_SINK } from './ports/audit-sink.port';
import { LoggerAuditSink } from './sinks/logger-audit.sink';

/**
 * Global audit module. Exposes AuditService app-wide and binds the default
 * structured-log sink. Re-bind AUDIT_SINK to persist audits (Oracle/SIEM).
 */
@Global()
@Module({
  providers: [AuditService, { provide: AUDIT_SINK, useClass: LoggerAuditSink }],
  exports: [AuditService],
})
export class AuditModule {}
