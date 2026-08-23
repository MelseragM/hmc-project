import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { isKnownOracleObject } from '@shared/constants/oracle-objects';
import {
  EMP_KEY_COLUMN,
  PERSON_ID_COLUMN,
  USERNAME_KEY_CANDIDATES,
} from '@shared/constants/oracle-columns';
import { LovReadOptions, LovRepository } from '../../domain/lov.repository';
import { LovMapper } from './lov.mapper';

/**
 * Generic Oracle adapter for LOV/view reads (Pattern A). Object names are
 * validated against the central allow-list before interpolation (injection-safe).
 *
 * A caller filter is applied only when supplied and when the object really has
 * a matching scoping column: the user-scoped LOVs (SCHOOL_NAME_LOV,
 * REQUEST_TYPE_LOV) are documented with a `USER_NAME` request parameter, and
 * filtering on a hard-coded `username` raised `ORA-00904: "USERNAME": invalid
 * identifier`. The column is therefore resolved from the data dictionary, and
 * a filter value passed for a LOV that is not scoped is ignored instead of
 * failing the request.
 *
 * Some user-scoped views expose no user column at all: LEAVE_AMEND_V is scoped
 * by employee number in the legacy service (`lovname=LEAVE_AMEND_LOV&enum=`),
 * and dropping the filter turned the read into an unfiltered full scan that
 * blew past the 25s call timeout (ORA-03156). When no user column exists we
 * fall back to the employee-number / person-id columns so the filter still
 * applies.
 */
const EMPLOYEE_SCOPING_CANDIDATES = [EMP_KEY_COLUMN, 'emp_num', PERSON_ID_COLUMN] as const;
@Injectable()
export class LovOracleRepository implements LovRepository {
  private readonly cache = new Map<string, { expiresAt: number; items: LovItem[] }>();
  private readonly pending = new Map<string, Promise<LovItem[]>>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly ora: OracleService,
    private readonly schema: OracleSchemaService,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.get<number>('app.lovCacheTtlMs', 300000);
  }

  async readLov(
    object: string,
    lang: Lang,
    username?: string,
    options: LovReadOptions = {},
  ): Promise<LovItem[]> {
    if (!isKnownOracleObject(object)) {
      throw new BadRequestException(`Unknown Oracle object: ${object}`);
    }
    const cacheKey = JSON.stringify([object, lang, username ?? '', options]);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    const active = this.pending.get(cacheKey);
    if (active) return active;

    const request = this.queryLov(object, lang, username, options);
    this.pending.set(cacheKey, request);
    try {
      const items = await request;
      if (this.cacheTtlMs > 0) {
        this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, items });
      }
      return items;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  private async queryLov(
    object: string,
    lang: Lang,
    username: string | undefined,
    options: LovReadOptions,
  ): Promise<LovItem[]> {
    const keyColumn = username ? await this.userColumnOf(object) : undefined;
    const searchColumn = options.search ? await this.searchColumnOf(object) : undefined;
    const typeColumn = options.dataType ? await this.typeColumnOf(object) : undefined;
    const leaveTypeColumn = options.leaveType ? await this.leaveTypeColumnOf(object) : undefined;
    const conditions: string[] = [];
    const binds: oracledb.BindParameters = {};
    if (keyColumn) {
      conditions.push(`${keyColumn} = :u`);
      binds.u = username;
    }
    if (searchColumn && options.search) {
      conditions.push(`UPPER(${searchColumn}) LIKE :search`);
      binds.search = `%${options.search.trim().toUpperCase()}%`;
    }
    if (typeColumn && options.dataType) {
      conditions.push(`UPPER(${typeColumn}) = :dataType`);
      binds.dataType = options.dataType.trim().toUpperCase();
    }
    if (leaveTypeColumn && options.leaveType) {
      conditions.push(`UPPER(${leaveTypeColumn}) = :leaveType`);
      binds.leaveType = options.leaveType.trim().toUpperCase();
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit;
    const pagination = limit
      ? ' ORDER BY 1 OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY'
      : '';
    if (limit) {
      binds.offset = options.offset ?? 0;
      binds.limit = limit;
    }
    const rows = await this.ora.query<Record<string, any>>(
      `SELECT * FROM ${object}${where}${pagination}`,
      binds,
    );
    return LovMapper.toItems(rows, lang);
  }

  /**
   * The scoping column of a user-scoped LOV: the user column when the view
   * has one, otherwise the employee-number / person-id column (LEAVE_AMEND_V
   * case), or undefined when the view is not scoped at all.
   */
  private async userColumnOf(object: string): Promise<string | undefined> {
    for (const candidate of [...USERNAME_KEY_CANDIDATES, ...EMPLOYEE_SCOPING_CANDIDATES]) {
      if (await this.schema.hasColumn(object, candidate)) return candidate;
    }
    return undefined;
  }

  private async searchColumnOf(object: string): Promise<string | undefined> {
    for (const candidate of ['NAME', 'VALUE', 'MEANING', 'FLEX_VALUE_MEANING']) {
      if (await this.schema.hasColumn(object, candidate)) return candidate;
    }
    return undefined;
  }

  /**
   * The grouping column of a multi-type LOV (DEP_LOOKUP_LOV exposes
   * `D_DATA_TYPE`), resolved from the data dictionary like the other filters
   * so a dataType passed for a single-type LOV is ignored instead of failing.
   */
  private async typeColumnOf(object: string): Promise<string | undefined> {
    for (const candidate of ['D_DATA_TYPE', 'DATATYPE', 'DATA_TYPE', 'LOOKUP_TYPE']) {
      if (await this.schema.hasColumn(object, candidate)) return candidate;
    }
    return undefined;
  }

  /**
   * The leave-type column of a type-scoped LOV (ABSENCE_REASON_V exposes
   * `LEAVE_TYPE`), resolved from the data dictionary like the other filters
   * so a leaveType passed for an unscoped LOV is ignored instead of failing.
   */
  private async leaveTypeColumnOf(object: string): Promise<string | undefined> {
    for (const candidate of ['LEAVE_TYPE', 'ABSENCE_TYPE']) {
      if (await this.schema.hasColumn(object, candidate)) return candidate;
    }
    return undefined;
  }
}
