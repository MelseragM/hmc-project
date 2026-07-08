import { BadRequestException, Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { isKnownOracleObject } from '@shared/constants/oracle-objects';
import { LovRepository } from '../../domain/lov.repository';
import { LovMapper } from './lov.mapper';

/**
 * Generic Oracle adapter for LOV/view reads (Pattern A). Object names are
 * validated against the central allow-list before interpolation (injection-safe).
 * A `username` filter is applied only when supplied and when the object supports
 * it (LOVs whose rows are user-scoped, e.g. SCHOOL_NAME_LOV, REQUEST_TYPE_LOV).
 */
@Injectable()
export class LovOracleRepository implements LovRepository {
  constructor(private readonly ora: OracleService) {}

  async readLov(object: string, lang: Lang, username?: string): Promise<LovItem[]> {
    if (!isKnownOracleObject(object)) {
      throw new BadRequestException(`Unknown Oracle object: ${object}`);
    }
    const sql = username
      ? `SELECT * FROM ${object} WHERE username = :u`
      : `SELECT * FROM ${object}`;
    const binds = username ? { u: username } : {};
    const rows = await this.ora.query<Record<string, any>>(sql, binds);
    return LovMapper.toItems(rows, lang);
  }
}
