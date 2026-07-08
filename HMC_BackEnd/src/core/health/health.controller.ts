import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OracleService } from '../database/oracle.service';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../http/response.interceptor';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly oracle: OracleService) {}

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
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      oracle: { enabled: oracleEnabled, reachable: oracleReachable },
      timestamp: new Date().toISOString(),
    };
  }
}
