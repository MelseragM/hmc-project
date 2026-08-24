import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { AppConfig, UsersDbConfig } from '../config/configuration';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../http/response.interceptor';
import { MssqlService } from './mssql.service';
import {
  OracleCallOp,
  OracleCallStatus,
  OracleLogStore,
} from './oracle-log.store';
import { ORACLE_LOG_VIEW_HTML } from './oracle-log.view';
import { OracleMetadataService } from './oracle-metadata.service';
import { assertReadOnlySelect } from './sql-console.util';

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

/** Body for POST /diagnostics/users-db/sql. */
export class UsersDbSqlRequestDto {
  /** A single SELECT (or WITH … SELECT) statement; may use named `@params`. */
  @IsString()
  @IsNotEmpty()
  sql!: string;

  /** Values for the statement's named `@params` (parameterized binding). */
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  /** Max rows returned (default 200, cap 1000); extra rows are truncated. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxRows?: number;
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
  private readonly nodeEnv: string;
  private readonly usersDbCfg: UsersDbConfig;

  constructor(
    private readonly store: OracleLogStore,
    private readonly metadata: OracleMetadataService,
    private readonly mssql: MssqlService,
    config: ConfigService,
  ) {
    this.nodeEnv = config.getOrThrow<AppConfig>('app').nodeEnv;
    this.usersDbCfg = config.getOrThrow<UsersDbConfig>('usersDb');
  }

  /**
   * Ad-hoc read-only SQL console against the Users/Sanaad SQL Server DB.
   * SELECT-only (validated by assertReadOnlySelect before touching the
   * driver), gated by USERS_DB_SQL_ENABLED and hard-disabled in production.
   * Values should be passed via `params` (named `@p` binds), never inlined.
   */
  @Post('users-db/sql')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run a read-only SELECT against the Users DB (dev/staging only)',
    operationId: 'diag_usersDbSql',
  })
  async usersDbSql(@Body() body: UsersDbSqlRequestDto) {
    if (this.nodeEnv === 'production') {
      throw new ForbiddenException('The users-db SQL console is disabled in production.');
    }
    if (!this.usersDbCfg.sqlConsoleEnabled) {
      throw new ForbiddenException(
        'The users-db SQL console is disabled — set USERS_DB_SQL_ENABLED=true to enable it.',
      );
    }
    const statement = assertReadOnlySelect(body.sql);
    const maxRows = body.maxRows ?? 200;
    const started = Date.now();
    const rows = await this.mssql.query(statement, body.params ?? {});
    return {
      rowCount: Math.min(rows.length, maxRows),
      totalRows: rows.length,
      truncated: rows.length > maxRows,
      durationMs: Date.now() - started,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows: rows.slice(0, maxRows),
    };
  }

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
  // helmet's default CSP blocks inline <script>/onclick; relax it for this
  // self-contained diagnostics page (overrides the global header for this route).
  @Header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
  )
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
