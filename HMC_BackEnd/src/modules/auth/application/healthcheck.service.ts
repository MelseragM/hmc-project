import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLaunchConfig } from '@core/config/configuration';
import { HealthCheckRequestDto, HealthCheckResponseDto } from '../interface/dto/healthcheck.dto';

/**
 * API-1 app-launch health check. Downtime window + forced/optional update are
 * driven by config (APP_* env) so ops can toggle maintenance without a deploy.
 */
@Injectable()
export class HealthCheckService {
  private readonly cfg: AppLaunchConfig;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<AppLaunchConfig>('appLaunch');
  }

  check(req: HealthCheckRequestDto): HealthCheckResponseDto {
    const updatetype = this.resolveUpdateType(req.version);
    return this.cfg.downtime
      ? {
          appDowntime: 'Yes',
          downtimeStart: this.cfg.downtimeStart,
          downtimeEnd: this.cfg.downtimeEnd,
          updatetype,
        }
      : { appDowntime: 'No', downtimeStart: '', downtimeEnd: '', updatetype };
  }

  /** R = not required, O = optional, M = mandatory (below min supported version). */
  private resolveUpdateType(version?: string): 'R' | 'O' | 'M' {
    if (!version) return 'R';
    if (this.compareVersions(version, this.cfg.minSupportedVersion) < 0) return 'M';
    if (this.compareVersions(version, this.cfg.latestVersion) < 0) return 'O';
    return 'R';
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((n) => Number(n) || 0);
    const pb = b.split('.').map((n) => Number(n) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    }
    return 0;
  }
}
