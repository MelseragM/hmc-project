import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OracleService } from '../database/oracle.service';
import { MssqlService } from '../database/mssql.service';
import { MotcSmsDbService } from '../database/motc-sms-db.service';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../http/response.interceptor';
import { DiagnosticsEnabledGuard } from '../http/diagnostics-enabled.guard';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly oracle: OracleService,
    private readonly usersDb: MssqlService,
    private readonly motcSmsDb: MotcSmsDbService,
  ) {}

  @Public()
  @SkipEnvelope()
  @Get()
  async check() {
    const oracleEnabled = this.oracle.isEnabled();
    let oracleReachable = false;
    if (oracleEnabled) {
      try {
        oracleReachable = await this.oracle.ping();
      } catch {
        oracleReachable = false;
      }
    }
    const usersDbEnabled = this.usersDb.isEnabled();
    const usersDbReachable = usersDbEnabled ? await this.usersDb.ping() : false;
    const motcSmsDbEnabled = this.motcSmsDb.isEnabled();
    const motcSmsDbReachable = motcSmsDbEnabled ? await this.motcSmsDb.ping() : false;
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      oracle: { enabled: oracleEnabled, reachable: oracleReachable },
      usersDb: { enabled: usersDbEnabled, reachable: usersDbReachable },
      motcSmsDb: { enabled: motcSmsDbEnabled, reachable: motcSmsDbReachable },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dedicated Oracle connectivity test. Acquires a real connection, runs a
   * probe query, and reports latency, server version and DB time — or the
   * exact failure reason (message + ORA code) when the database is unreachable.
   * Always responds 200; inspect `status`/`connected` for the result.
   * 404 with DIAGNOSTICS_ENABLED=false (plain /health stays on).
   */
  @UseGuards(DiagnosticsEnabledGuard)
  @Public()
  @SkipEnvelope()
  @Get('db')
  @ApiOperation({ summary: 'Oracle DB connectivity test', operationId: 'health_db' })
  @ApiOkResponse({ description: 'Connectivity diagnostics (status=ok when connected).' })
  async db() {
    const diagnostics = await this.oracle.diagnose();
    return { status: diagnostics.connected ? 'ok' : 'error', ...diagnostics };
  }

  /**
   * Dedicated Users DB (SQL Server) connectivity test — the auth-cycle
   * database (device/MPIN/OTP + API-1 tables). Same contract as /health/db:
   * always 200, inspect `status`/`connected` and `error` for the reason.
   */
  @UseGuards(DiagnosticsEnabledGuard)
  @Public()
  @SkipEnvelope()
  @Get('users-db')
  @ApiOperation({ summary: 'Users DB (SQL Server) connectivity test', operationId: 'health_users_db' })
  @ApiOkResponse({ description: 'Connectivity diagnostics (status=ok when connected).' })
  async usersDbHealth() {
    const diagnostics = await this.usersDb.diagnose();
    return { status: diagnostics.connected ? 'ok' : 'error', ...diagnostics };
  }

  /**
   * Dedicated MOTC SMS gateway DB connectivity test — the OTP push-table
   * database (MOTC_SMS_PushTable). Same contract as /health/users-db.
   */
  @UseGuards(DiagnosticsEnabledGuard)
  @Public()
  @SkipEnvelope()
  @Get('motc-sms-db')
  @ApiOperation({
    summary: 'MOTC SMS DB (SQL Server) connectivity test',
    operationId: 'health_motc_sms_db',
  })
  @ApiOkResponse({ description: 'Connectivity diagnostics (status=ok when connected).' })
  async motcSmsDbHealth() {
    const diagnostics = await this.motcSmsDb.diagnose();
    return { status: diagnostics.connected ? 'ok' : 'error', ...diagnostics };
  }
}
