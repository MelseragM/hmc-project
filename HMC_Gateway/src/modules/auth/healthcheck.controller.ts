import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@core/auth/decorators/public.decorator';
import { ProxyService } from '../proxy/proxy.service';

/** API-1 — App-launch health check (downtime + forced/optional update), forwarded to HMC_BackEnd. */
@ApiTags('auth')
@Controller('healthcheck')
export class HealthCheckController {
  constructor(private readonly proxy: ProxyService) {}

  @Public()
  @HttpCode(200)
  @Post()
  @ApiOperation({ summary: 'API-1 — Health Check (app launch)', operationId: 'auth_healthCheck' })
  check(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }
}
