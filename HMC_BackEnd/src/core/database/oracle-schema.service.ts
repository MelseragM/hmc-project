import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleArgumentInfo, OracleMetadataService } from './oracle-metadata.service';
import { SchemaColumnNotFoundException } from './schema-column-not-found.error';

/** One formal parameter of a procedure, reduced to what binding needs. */
export interface ProcedureParam {
  name: string;
  /** `IN`, `OUT` or `IN/OUT` as reported by ALL_ARGUMENTS. */
  direction: string;
  dataType: string;
}

/**
 * Answers schema questions about the `XXHMC_SND_*` objects from the Oracle data
 * dictionary, so adapters bind what the database actually declares.
 *
 * Two classes of runtime failure motivated this:
 *  - `ORA-00904: invalid identifier` — the Sanaad mapping documents the legacy
 *    *request parameter* names (`USER_NAME`, `EMPLOYEE_NUMBER`), not the view
 *    column names, and they differ per object.
 *  - `PLS-00306: wrong number or types of arguments` — the request-input tables
 *    list only the IN parameters, so the OUT contract was assumed to be
 *    `p_status` / `p_message` everywhere, while REASSIGN_PR (for one) declares
 *    `p_success_flag` / `p_error_msg` / `p_error_msg_ar`.
 *
 * Everything is read once per object and cached for the process lifetime.
 */
@Injectable()
export class OracleSchemaService {
  private readonly logger = new Logger(OracleSchemaService.name);
  /** object → upper-cased column names. */
  private readonly columnCache = new Map<string, Set<string>>();
  /** object → declared parameters, or null when the dictionary knows none. */
  private readonly paramCache = new Map<string, ProcedureParam[] | null>();

  constructor(private readonly metadata: OracleMetadataService) {}

  /**
   * Returns the first candidate column that exists on `object`. Falls back to the
   * first candidate when the dictionary lookup yields nothing (e.g. the account
   * cannot read ALL_TAB_COLUMNS) so behaviour stays unchanged rather than
   * breaking.
   */
  async resolveKeyColumn(object: string, candidates: readonly string[]): Promise<string> {
    const available = await this.columnsOf(object);
    if (!available.size) return candidates[0];

    const match = candidates.find((c) => available.has(c.toUpperCase()));
    if (match) return match;

    // A schema mismatch (missing/renamed column) — NOT a connectivity/timeout/
    // permission problem. Distinct type so callers can degrade gracefully
    // instead of failing the whole request (see readByResolvedKey).
    throw new SchemaColumnNotFoundException(object, candidates, [...available]);
  }

  /** True when `object` exposes `column`. */
  async hasColumn(object: string, column: string): Promise<boolean> {
    const available = await this.columnsOf(object);
    return available.has(column.toUpperCase());
  }

  /**
   * Declared parameters of a procedure (or of `PACKAGE.PROCEDURE`), in
   * positional order, or undefined when the dictionary has no entry for it.
   */
  async resolveParams(object: string): Promise<ProcedureParam[] | undefined> {
    const key = object.toUpperCase();
    if (!this.paramCache.has(key)) {
      this.paramCache.set(key, await this.readParams(object));
    }
    return this.paramCache.get(key) ?? undefined;
  }

  /** Maps an Oracle argument data type to the OUT bind type to use. */
  static outBindType(dataType: string): oracledb.DbType {
    switch (dataType.toUpperCase()) {
      case 'NUMBER':
      case 'INTEGER':
      case 'FLOAT':
        return oracledb.DB_TYPE_NUMBER;
      case 'DATE':
      case 'TIMESTAMP':
        return oracledb.DB_TYPE_DATE;
      case 'REF CURSOR':
        return oracledb.DB_TYPE_CURSOR;
      default:
        return oracledb.DB_TYPE_VARCHAR;
    }
  }

  private async readParams(object: string): Promise<ProcedureParam[] | null> {
    const [pkg, member] = object.toUpperCase().split('.');
    const target = member ?? pkg;
    try {
      const described = await this.metadata.describeArguments(object);
      const args = described.filter(
        (a) => a.objectName === target && a.name && a.position > 0,
      );
      return args.length ? args.map((a) => this.toParam(a)) : null;
    } catch (err) {
      this.logger.warn(`Could not read the signature of ${object}: ${(err as Error).message}`);
      return null;
    }
  }

  private toParam(arg: OracleArgumentInfo): ProcedureParam {
    return {
      name: (arg.name as string).toLowerCase(),
      direction: (arg.direction ?? 'IN').toUpperCase(),
      dataType: arg.dataType ?? 'VARCHAR2',
    };
  }

  private async columnsOf(object: string): Promise<Set<string>> {
    const key = object.toUpperCase();
    const cached = this.columnCache.get(key);
    if (cached) return cached;

    let names = new Set<string>();
    try {
      const columns = await this.metadata.describeColumns(object);
      names = new Set(columns.map((c) => c.name.toUpperCase()));
    } catch (err) {
      this.logger.warn(`Could not describe ${object}: ${(err as Error).message}`);
    }
    this.columnCache.set(key, names);
    return names;
  }
}
