import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { ProxyService } from './proxy.service';

/**
 * Generic catch-all: every request that isn't handled by an explicit
 * controller (the pre-login auth journey, /health) lands here. Guarded by
 * the global JwtAuthGuard (APP_GUARD in CoreModule) since no @Public() is
 * applied — a valid bearer token is required. Registered last so explicit
 * routes win on specificity, per Nest's routing rules.
 */
@ApiExcludeController()
@Controller()
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  async proxyAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward(req, res);
  }
}
