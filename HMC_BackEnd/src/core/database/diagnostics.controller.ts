import { Controller, Delete, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  OracleCallOp,
  OracleCallStatus,
  OracleLogStore,
} from './oracle-log.store';

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

/**
 * Diagnostics API over the in-memory Oracle call log (see OracleLogStore).
 * Lets you list/filter every Oracle call the backend made (object, binds,
 * duration, status, ORA code, correlation id) — the structured view of the
 * `[ora#N]` console logs. In-memory only; cleared on restart.
 */
@ApiTags('diagnostics')
@Controller('diagnostics/oracle-logs')
export class DiagnosticsController {
  constructor(private readonly store: OracleLogStore) {}

  @Get()
  @ApiOperation({ summary: 'List Oracle call logs (filterable)', operationId: 'diag_oracleLogs' })
  list(@Query() query: OracleLogQueryDto) {
    return this.store.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Oracle call log aggregates', operationId: 'diag_oracleLogStats' })
  stats() {
    return this.store.stats();
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the Oracle call log buffer', operationId: 'diag_oracleLogsClear' })
  clear() {
    return { cleared: this.store.clear() };
  }
}
