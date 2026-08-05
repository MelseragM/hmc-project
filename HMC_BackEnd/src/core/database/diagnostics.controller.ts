import { Controller, Delete, Get, Header, Query } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../http/response.interceptor';
import {
  OracleCallOp,
  OracleCallStatus,
  OracleLogStore,
} from './oracle-log.store';
import { ORACLE_LOG_VIEW_HTML } from './oracle-log.view';
import { OracleMetadataService } from './oracle-metadata.service';

/** Query filters for GET /diagnostics/oracle-logs. */
export class OracleLogQueryDto {
  @IsOptional()
  @IsIn(['success', 'error'])
  status?: OracleCallStatus;

  @IsOptional()
  @IsIn(['query', 'call', 'callCursor'])
  op?: OracleCallOp;

  @IsOptional()
  @IsString()
  object?: string;

  @IsOptional()
  @IsString()
  enum?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  oraCode?: number;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

/** Query for GET /diagnostics/oracle-object. */
export class OracleObjectQueryDto {
  /** Allow-listed `XXHMC_SND_*` object name, optionally `PACKAGE.PROCEDURE`. */
  @IsString()
  name!: string;
}

/**
 * Diagnostics API over the in-memory Oracle call log (see OracleLogStore).
 * Lets you list/filter every Oracle call the backend made (object, binds,
 * duration, status, ORA code, correlation id) — the structured view of the
 * `[ora#N]` console logs. In-memory only; cleared on restart.
 */
@ApiTags('diagnostics')
@Controller('diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly store: OracleLogStore,
    private readonly metadata: OracleMetadataService,
  ) {}

  /**
   * Data-dictionary description of a known Oracle object: whether it is a view,
   * procedure or package, its column list and its formal parameter list. Use it
   * to confirm key columns / bind names instead of assuming them.
   */
  @Get('oracle-object')
  @ApiOperation({ summary: 'Describe an Oracle object (type, columns, arguments)', operationId: 'diag_oracleObject' })
  describeObject(@Query() query: OracleObjectQueryDto) {
    return this.metadata.describe(query.name);
  }

  /**
   * Browser view: a filterable table (enum, correlationId, object, oraCode, …)
   * rendered from the JSON list endpoint. @Public so it loads in a browser;
   * gate/remove it before production if the SQL log is sensitive.
   */
  @Public()
  @SkipEnvelope()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  @Get('oracle-logs/view')
  view(): string {
    return ORACLE_LOG_VIEW_HTML;
  }

  @Get('oracle-logs')
  @ApiOperation({ summary: 'List Oracle call logs (filterable)', operationId: 'diag_oracleLogs' })
  list(@Query() query: OracleLogQueryDto) {
    return this.store.list(query);
  }

  @Get('oracle-logs/stats')
  @ApiOperation({ summary: 'Oracle call log aggregates', operationId: 'diag_oracleLogStats' })
  stats() {
    return this.store.stats();
  }

  @Delete('oracle-logs')
  @ApiOperation({ summary: 'Clear the Oracle call log buffer', operationId: 'diag_oracleLogsClear' })
  clear() {
    return { cleared: this.store.clear() };
  }
}
