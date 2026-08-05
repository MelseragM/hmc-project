import { BadRequestException, Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleColumnResolver } from '@core/database/oracle-column.resolver';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { isKnownOracleObject } from '@shared/constants/oracle-objects';
import { USERNAME_KEY_CANDIDATES } from '@shared/constants/oracle-columns';
import { LovRepository } from '../../domain/lov.repository';
import { LovMapper } from './lov.mapper';

/**
 * Generic Oracle adapter for LOV/view reads (Pattern A). Object names are
 * validated against the central allow-list before interpolation (injection-safe).
 *
 * A `username` filter is applied only when supplied and when the object really
 * has a user column: the user-scoped LOVs (SCHOOL_NAME_LOV, REQUEST_TYPE_LOV)
 * are documented with a `USER_NAME` request parameter, and filtering on a
 * hard-coded `username` raised `ORA-00904: "USERNAME": invalid identifier`. The
 * column is therefore resolved from the data dictionary, and a username passed
 * for a LOV that is not user-scoped is ignored instead of failing the request.
 */
@Injectable()
export class LovOracleRepository implements LovRepository {
  constructor(
    private readonly ora: OracleService,
    private readonly columns: OracleColumnResolver,
  ) {}

  async readLov(object: string, lang: Lang, username?: string): Promise<LovItem[]> {
    if (!isKnownOracleObject(object)) {
      throw new BadRequestException(`Unknown Oracle object: ${object}`);
    }
    const keyColumn = username ? await this.userColumnOf(object) : undefined;
    const sql = keyColumn
      ? `SELECT * FROM ${object} WHERE ${keyColumn} = :u`
      : `SELECT * FROM ${object}`;
    const rows = await this.ora.query<Record<string, any>>(sql, keyColumn ? { u: username } : {});
    return LovMapper.toItems(rows, lang);
  }

  /** The user column of a user-scoped LOV, or undefined when it has none. */
  private async userColumnOf(object: string): Promise<string | undefined> {
    for (const candidate of USERNAME_KEY_CANDIDATES) {
      if (await this.columns.hasColumn(object, candidate)) return candidate;
    }
    return undefined;
  }
}
