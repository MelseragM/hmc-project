import { Logger, NotImplementedException } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from './oracle.service';
import { OracleSchemaService, ProcedureParam } from './oracle-schema.service';
import { SubmitResult } from '@shared/domain/submit-result';
import { safeDecodeUri } from '@shared/utils/url-decode.util';
import { ERROR_MESSAGES, extractOraCode } from '@shared/constants/error-codes';
import { EMP_KEY_COLUMN, USERNAME_COLUMN } from '@shared/constants/oracle-columns';
import { CATEGORY_MESSAGE, ErrorCategory, looksSensitive } from '../http/error-category';
import { SchemaColumnNotFoundException } from './schema-column-not-found.error';
import { RequestContext } from '../http/request-context';

/**
 * Base class for Oracle adapters. Centralizes the OUT-bind conventions
 * (`p_status` / `p_message`) so every `_PR`/`_PKG` call maps to a uniform
 * SubmitResult. Concrete repositories extend this and inject OracleService.
 *
 * See Docs_Ai/Repository Pattern/README.md (Recommendations).
 */
export abstract class BaseOracleRepository {
  /** Named after the concrete subclass so log lines identify the adapter. */
  private readonly logger = new Logger(this.constructor.name);

  /**
   * `schema` is optional: adapters that read views whose key column is not
   * certain, or that call procedures whose OUT contract is not certain, inject it
   * and use `readByResolvedKey` / `callSubmitProc`; the rest keep the
   * single-argument constructor.
   */
  constructor(
    protected readonly ora: OracleService,
    protected readonly schema?: OracleSchemaService,
  ) {}

  /** Parameterized SELECT against a view/LOV (Pattern A). */
  protected query<T = Record<string, any>>(
    sql: string,
    binds: oracledb.BindParameters = {},
  ): Promise<T[]> {
    return this.ora.query<T>(sql, binds);
  }

  /** Anonymous PL/SQL block for `_PR`/`_PKG` with OUT binds (Pattern B/C). */
  protected call<T = Record<string, any>>(
    plsql: string,
    binds: oracledb.BindParameters,
    options: oracledb.ExecuteOptions = {},
  ): Promise<T> {
    return this.ora.call<T>(plsql, binds, options);
  }

  /** PL/SQL returning a REF CURSOR read into an array. */
  protected callCursor<T = Record<string, any>>(
    plsql: string,
    binds: oracledb.BindParameters,
    cursorBindName = 'cursor',
  ): Promise<T[]> {
    return this.ora.callCursor<T>(plsql, binds, cursorBindName);
  }

  /** SELECT all rows from an employee-scoped view (Pattern A). */
  protected readByEmployee<T = Record<string, any>>(
    object: string,
    employeeNumber: string,
    keyColumn: string = EMP_KEY_COLUMN,
  ): Promise<T[]> {
    return this.query<T>(`SELECT * FROM ${object} WHERE ${keyColumn} = :enum`, {
      enum: employeeNumber,
    });
  }

  /** SELECT all rows from a username-scoped view/LOV (Pattern A). */
  protected readByUsername<T = Record<string, any>>(
    object: string,
    username: string,
    keyColumn: string = USERNAME_COLUMN,
  ): Promise<T[]> {
    return this.query<T>(`SELECT * FROM ${object} WHERE ${keyColumn} = :u`, { u: username });
  }

  /**
   * SELECT from a view filtered on whichever of `candidates` the view really
   * exposes (see OracleSchemaService). Use this instead of guessing between
   * documented request-parameter names such as USER_NAME vs EMPLOYEE_NUMBER.
   *
   * A schema mismatch (none of the candidates exist on `object`) is NOT
   * allowed to fail the request: it's logged as a SCHEMA_MISMATCH warning
   * (with the view, missing/available columns and calling repository) and
   * this read degrades to an empty result, so the rest of the response —
   * built from whichever OTHER reads/views succeeded — is still returned as
   * HTTP 200. Any other failure (connectivity, permissions, timeouts, real
   * SQL errors) is untouched and still propagates to the global handler.
   */
  protected async readByResolvedKey<T = Record<string, any>>(
    object: string,
    value: string,
    candidates: readonly string[],
  ): Promise<T[]> {
    if (!this.schema) {
      throw new Error(
        `${this.constructor.name} must inject OracleSchemaService to use readByResolvedKey.`,
      );
    }
    try {
      const keyColumn = await this.schema.resolveKeyColumn(object, candidates);
      return await this.query<T>(`SELECT * FROM ${object} WHERE ${keyColumn} = :key`, {
        key: value,
      });
    } catch (err) {
      if (err instanceof SchemaColumnNotFoundException) {
        this.logSchemaMismatch(err);
        return [];
      }
      throw err;
    }
  }

  /** Structured, internal-only WARNING for a caught schema mismatch (never a fatal error). */
  private logSchemaMismatch(err: SchemaColumnNotFoundException): void {
    const requestId = RequestContext.get()?.correlationId ?? '-';
    this.logger.warn(
      `[SCHEMA_MISMATCH] requestId=${requestId} repository=${this.constructor.name} ` +
        `object=${err.object} missingCandidates=[${err.candidates.join(', ')}] ` +
        `availableColumns=[${err.availableColumns.join(', ')}] — degrading to an empty result ` +
        `instead of failing the request.`,
      err.stack,
    );
  }

  /**
   * Marks an adapter whose exact Oracle bind signature is not yet captured
   * (see Docs_Ai known gaps). Throws 501 until implemented.
   */
  protected notImplemented(object: string): never {
    throw new NotImplementedException(`${ERROR_MESSAGES.NOT_IMPLEMENTED} [${object}]`);
  }

  /**
   * Call a submit-style `_PR`/`_PKG` procedure and map its OUT binds to a
   * SubmitResult.
   *
   * The argument list is taken from the data dictionary when it is readable, so
   * the call always matches what the database declares — both the IN parameters
   * and the OUT contract, which the Sanaad request-input tables do not list. That
   * matters because the OUT names are not uniform (`p_status` / `p_message` for
   * the phone package, `p_success_flag` / `p_error_msg` / `p_error_msg_ar` for
   * REASSIGN_PR), and a named argument the procedure does not declare raises
   * `PLS-00306: wrong number or types of arguments`.
   *
   * When the dictionary is unavailable it falls back to the documented `params`
   * plus `outBinds`. Every parameter is always bound (NULL when absent from
   * `values`) so the full argument list is satisfied.
   */
  protected async callSubmitProc(
    object: string,
    params: readonly string[],
    values: Record<string, unknown>,
    outBinds: oracledb.BindParameters = this.statusOutBinds(),
  ): Promise<SubmitResult> {
    const declared = await this.schema?.resolveParams(object, params);
    const binds: oracledb.BindParameters = {};
    const names: string[] = [];

    if (declared?.length) {
      for (const param of declared) {
        names.push(param.name);
        if (param.direction.includes('OUT')) {
          (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.outBind(
            param,
            BaseOracleRepository.pick(values, param.name),
          );
          continue;
        }
        if (
          !param.defaulted &&
          !BaseOracleRepository.hasValue(values, param.name) &&
          !BaseOracleRepository.isExpected(params, param.name)
        ) {
          // The dictionary declares a parameter the mapping does not know. Keep
          // the call alive (NULL bind, the legacy services do the same) but
          // surface the drift so the documented param list gets updated.
          this.logger.warn(`Unmapped Oracle parameter ${object}.${param.name} bound as NULL`);
        }
        (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.inBind(
          param,
          BaseOracleRepository.pick(values, param.name),
        );
      }
    } else {
      Object.assign(binds, outBinds);
      names.push(...params, ...Object.keys(outBinds));
      for (const p of params) {
        (binds as Record<string, unknown>)[p] = BaseOracleRepository.pick(values, p);
      }
    }

    const namedArgs = names.map((n) => `${n} => :${n}`).join(',\n          ');
    const out = await this.call<Record<string, any>>(
      `BEGIN ${object}(\n          ${namedArgs}); END;`,
      binds,
    );
    return this.toSubmitResult(out);
  }

  /**
   * Call a procedure that returns its rows through a REF CURSOR (leave balance,
   * child details). Like `callSubmitProc` the argument list comes from the data
   * dictionary when it is readable — including the real name of the cursor
   * parameter, which differs between procedures — and falls back to the
   * documented `params` plus `cursorParam` otherwise.
   */
  protected async callRowsProc<T = Record<string, any>>(
    object: string,
    params: readonly string[],
    values: Record<string, unknown>,
    cursorParam = 'p_cursor',
  ): Promise<T[]> {
    const declared = await this.schema?.resolveParams(object, params);

    if (declared?.length) {
      const binds: oracledb.BindParameters = {};
      const names: string[] = [];
      let cursorName = cursorParam;
      for (const param of declared) {
        names.push(param.name);
        const isCursor =
          param.direction.includes('OUT') && param.dataType.toUpperCase() === 'REF CURSOR';
        if (isCursor) {
          // The row set. Bind it under its real formal name and tell callCursor
          // which OUT bind to read.
          cursorName = param.name;
          (binds as Record<string, unknown>)[param.name] = {
            dir: oracledb.BIND_OUT,
            type: oracledb.CURSOR,
          };
          continue;
        }
        if (param.direction.includes('OUT')) {
          // A scalar OUT the procedure also declares (e.g. GET_PAYSLIP_PERIODS'
          // p_success_flag / p_error_msg). It must be bound or the call is short
          // an argument — PLS-00306. Its value is unused here.
          (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.outBind(
            param,
            BaseOracleRepository.pick(values, param.name),
          );
          continue;
        }
        (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.inBind(
          param,
          BaseOracleRepository.pick(values, param.name),
        );
      }
      const namedArgs = names.map((n) => `${n} => :${n}`).join(',\n          ');
      return this.callCursor<T>(`BEGIN ${object}(\n          ${namedArgs}); END;`, binds, cursorName);
    }

    const inParams = [...params];
    const binds: oracledb.BindParameters = { ...this.cursorOutBind() };
    for (const p of inParams) {
      (binds as Record<string, unknown>)[p] = BaseOracleRepository.pick(values, p);
    }
    const namedArgs = [...inParams.map((p) => `${p} => :${p}`), `${cursorParam} => :cursor`].join(
      ',\n          ',
    );
    return this.callCursor<T>(`BEGIN ${object}(\n          ${namedArgs}); END;`, binds);
  }

  /**
   * Call a procedure that returns MULTIPLE REF CURSORs in a single round trip
   * (e.g. PAYSLIP_PR: 7 separate cursors — earnings/deductions/totals/
   * balances/informations/net payments/housing — plus scalar OUT params).
   *
   * `callRowsProc` only tracks the *last* REF CURSOR it sees (one row set per
   * call); binding every cursor that way but reading only one back with
   * `callCursor` leaves the others open and can surface as
   * `NJS-107: invalid cursor` / `ORA-24338: statement handle not executed`.
   * This reads every declared REF CURSOR OUT bind into its own array, keyed by
   * its formal parameter name, plus every scalar OUT bind's raw value.
   *
   * Like `callRowsProc`/`callSubmitProc`, the argument list comes from the data
   * dictionary when readable and falls back to the documented `params` /
   * `cursorParams` / `scalarOutParams` otherwise.
   */
  protected async callMultiCursorProc(
    object: string,
    params: readonly string[],
    values: Record<string, unknown>,
    cursorParams: readonly string[],
    scalarOutParams: readonly string[] = [],
  ): Promise<{ cursors: Record<string, Record<string, any>[]>; scalars: Record<string, any> }> {
    const declared = await this.schema?.resolveParams(object, [
      ...params,
      ...cursorParams,
      ...scalarOutParams,
    ]);
    const binds: oracledb.BindParameters = {};
    const names: string[] = [];
    const cursorNames: string[] = [];
    const scalarNames: string[] = [];

    if (declared?.length) {
      for (const param of declared) {
        names.push(param.name);
        const isCursor =
          param.direction.includes('OUT') && param.dataType.toUpperCase() === 'REF CURSOR';
        if (isCursor) {
          cursorNames.push(param.name);
          (binds as Record<string, unknown>)[param.name] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
          continue;
        }
        if (param.direction.includes('OUT')) {
          scalarNames.push(param.name);
          (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.outBind(
            param,
            BaseOracleRepository.pick(values, param.name),
          );
          continue;
        }
        (binds as Record<string, unknown>)[param.name] = BaseOracleRepository.inBind(
          param,
          BaseOracleRepository.pick(values, param.name),
        );
      }
    } else {
      for (const p of params) {
        (binds as Record<string, unknown>)[p] = BaseOracleRepository.pick(values, p);
        names.push(p);
      }
      for (const c of cursorParams) {
        (binds as Record<string, unknown>)[c] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
        names.push(c);
        cursorNames.push(c);
      }
      for (const s of scalarOutParams) {
        (binds as Record<string, unknown>)[s] = {
          dir: oracledb.BIND_OUT,
          type: oracledb.STRING,
          maxSize: 4000,
        };
        names.push(s);
        scalarNames.push(s);
      }
    }

    const namedArgs = names.map((n) => `${n} => :${n}`).join(',\n          ');
    const out = await this.call<Record<string, any>>(
      `BEGIN ${object}(\n          ${namedArgs}); END;`,
      binds,
    );

    const cursors: Record<string, Record<string, any>[]> = {};
    for (const name of cursorNames) {
      const cursor = out[name] as oracledb.ResultSet<Record<string, any>> | undefined;
      cursors[name] = cursor ? ((await cursor.getRows(0)) ?? []) : [];
      if (cursor) await cursor.close();
    }
    const scalars: Record<string, any> = {};
    for (const name of scalarNames) {
      scalars[name] = out[name];
    }
    return { cursors, scalars };
  }

  /**
   * Value for a formal parameter, tolerating the `p_` prefix being present on one
   * side only: the Sanaad mapping documents some inputs bare (`PERSON_ID`,
   * `PERIOD`) and others prefixed (`P_USER_NAME`), while the declared parameter
   * name comes from the database. Returns null so the argument is still bound.
   */
  private static pick(values: Record<string, unknown>, param: string): unknown {
    const bare = param.replace(/^p_/, '');
    return values[param] ?? values[bare] ?? values[`p_${bare}`] ?? null;
  }

  /** First value that is non-null/undefined AND non-blank once trimmed to a string. */
  private static firstNonEmpty(...values: unknown[]): string {
    for (const v of values) {
      const s = (v ?? '').toString().trim();
      if (s) return s;
    }
    return '';
  }

  private static hasValue(values: Record<string, unknown>, param: string): boolean {
    const bare = param.replace(/^p_/, '');
    return [param, bare, `p_${bare}`].some((key) => Object.prototype.hasOwnProperty.call(values, key));
  }

  private static isExpected(params: readonly string[], param: string): boolean {
    const bare = param.replace(/^p_/, '');
    return params.some((candidate) => candidate.replace(/^p_/, '') === bare);
  }

  private static inBind(param: ProcedureParam, value: unknown): unknown {
    const type = OracleSchemaService.outBindType(param);
    // Attachments (p_attachmentN) are declared BLOB but arrive as base64 text;
    // a VARCHAR bind to a BLOB formal is a type mismatch → PLS-00306. Convert to
    // binary so node-oracledb binds an actual LOB.
    if (type === oracledb.DB_TYPE_BLOB) {
      return { type, val: BaseOracleRepository.toBlobBuffer(value) };
    }
    // DATE/TIMESTAMP formals arrive as request strings in whatever format the
    // caller used (`YYYYMMDD`, `YYYY-MM-DD`, `DD-MON-YYYY`, ...). Binding the
    // raw string leaves node-oracledb to bind it as VARCHAR2 and Oracle to
    // parse it against the session's NLS_DATE_FORMAT, which raised
    // ORA-01861 (`literal does not match format string`) and, for genuinely
    // unparseable input, ORA-01858. Parsing to a real JS `Date` here makes
    // node-oracledb bind it natively, bypassing NLS parsing entirely.
    if (type === oracledb.DB_TYPE_DATE || type === oracledb.DB_TYPE_TIMESTAMP) {
      return { type, val: BaseOracleRepository.toOracleDate(value) };
    }
    return typeof type === 'string' ? { type, val: value } : value;
  }

  /** A BLOB IN value: base64 text → Buffer; null/undefined/empty stay NULL. */
  private static toBlobBuffer(value: unknown): Buffer | null {
    if (value === null || value === undefined || value === '') return null;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(String(value), 'base64');
  }

  private static readonly MONTH_ABBR: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };

  /**
   * A DATE/TIMESTAMP IN value: request string → JS `Date`; null/undefined/
   * empty/unparseable stay `null` (never bind a placeholder like the literal
   * `"string"` a Swagger default can leave behind — that produced
   * ORA-01858, not a usable date).
   */
  private static toOracleDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const s = String(value).trim();
    if (!s) return null;

    // YYYYMMDD
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m) return BaseOracleRepository.toUtcDate(+m[1], +m[2], +m[3]);

    // YYYY-MM-DD
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return BaseOracleRepository.toUtcDate(+m[1], +m[2], +m[3]);

    // DD-MON-YYYY / DD-MON-YY / DD-Mon-YYYY (month as a 3-letter name)
    m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(s);
    if (m) {
      const month = BaseOracleRepository.MONTH_ABBR[m[2].toUpperCase()];
      if (month) {
        const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        return BaseOracleRepository.toUtcDate(year, month, Number(m[1]));
      }
    }

    // YYYY-MON-DD (e.g. '2025-OCT-17', seen in the identity module DTOs)
    m = /^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/.exec(s);
    if (m) {
      const month = BaseOracleRepository.MONTH_ABBR[m[2].toUpperCase()];
      if (month) return BaseOracleRepository.toUtcDate(Number(m[1]), month, Number(m[3]));
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private static toUtcDate(year: number, month: number, day: number): Date | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? null : date;
  }

  private static outBind(param: ProcedureParam, value: unknown): oracledb.BindParameter {
    const type = OracleSchemaService.outBindType(param);
    const dir = param.direction.includes('IN') ? oracledb.BIND_INOUT : oracledb.BIND_OUT;
    return type === oracledb.DB_TYPE_VARCHAR
      ? { dir, type, maxSize: 4000, ...(dir === oracledb.BIND_INOUT ? { val: value } : {}) }
      : { dir, type, ...(dir === oracledb.BIND_INOUT ? { val: value } : {}) };
  }

  /** `p_file_name1..N` / `p_attachment1..N` slot names shared by submit procs. */
  static attachmentParams(n = 10): string[] {
    const slots: string[] = [];
    for (let i = 1; i <= n; i++) slots.push(`p_file_name${i}`, `p_attachment${i}`);
    return slots;
  }

  /**
   * Standard OUT binds for a status flag + message returned by `_PR`
   * procedures — used as the fallback in `callSubmitProc` when the data
   * dictionary can't be read. `p_success_flag` was added as a third OUT param
   * across all submit procedures; omitting it raises `PLS-00306: wrong number
   * or types of arguments` now that the procedures declare it.
   */
  protected statusOutBinds(): oracledb.BindParameters {
    return {
      p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      p_success_flag: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
    };
  }

  /**
   * OUT binds for procedures that report `p_success_flag` + bilingual error
   * messages (documented signature of REASSIGN_PR: `..., p_success_flag,
   * p_error_msg, p_error_msg_ar`).
   */
  protected successFlagOutBinds(): oracledb.BindParameters {
    return {
      p_success_flag: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
      p_error_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
      p_error_msg_ar: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
    };
  }

  /** A REF CURSOR OUT bind (default name `cursor`). */
  protected cursorOutBind(): oracledb.BindParameters {
    return { cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } };
  }

  /**
   * Map common OUT-bind shapes to a SubmitResult. Accepts `{ p_status,
   * p_message }`, `{ p_success_flag, p_error_msg, p_error_msg_ar }` or
   * `{ status, msg }` style out binds.
   */
  protected toSubmitResult(out: Record<string, any>): SubmitResult {
    // `p_status` is now bound alongside `p_success_flag` on every submit proc
    // (see statusOutBinds); prefer whichever one actually came back non-empty
    // instead of a plain `??` chain, which would get stuck on an empty string
    // from a bound-but-unused param.
    const flagRaw = BaseOracleRepository.firstNonEmpty(
      out.p_success_flag,
      out.p_status,
      out.status,
      out.successflag,
    );
    const message = (out.p_message ?? out.p_error_msg ?? out.msg ?? out.errormessage ?? '').toString();
    const messageAr = out.p_message_ar ?? out.p_error_msg_ar ?? out.errormessage_ar;
    // Different procedures use different success conventions: 'S' (status),
    // 'Y' (p_success_flag, e.g. REASSIGN_PR-style: p_success_flag/p_error_msg/
    // p_error_msg_ar — { p_success_flag: "Y", p_error_msg: null, ... } is success),
    // or '0'.
    const flagUpper = flagRaw.toUpperCase();
    const isSuccess = flagUpper === 'S' || flagUpper === 'Y' || flagRaw === '0';
    let errormessage = message || (isSuccess ? 'Success' : 'Operation failed');
    let safeMessageAr = messageAr ? safeDecodeUri(messageAr) : undefined;

    // This channel (op result, HTTP 200) bypasses the exception filter, so an
    // Oracle proc surfacing an ORA-/PLS- error or SQL text in p_message must be
    // sanitized here too — never forward technical detail to the client.
    // A failed submit (p_success_flag/p_status = 'N') always comes back as an
    // error result, never a silent success — and a custom ORA-20xxx raise (a
    // business-rule validation, e.g. "FLEX-VALUE DOES NOT EXIST") is reported
    // as a business-rule failure rather than the generic database-error
    // message, matching how the same ORA range is classified for thrown
    // exceptions (see exception-classifier.ts).
    if (!isSuccess && looksSensitive(errormessage)) {
      const oraCode = extractOraCode(errormessage);
      const category =
        oraCode !== undefined && oraCode >= 20000 && oraCode <= 20999
          ? ErrorCategory.BUSINESS_RULE_ERROR
          : ErrorCategory.DATABASE_ERROR;
      this.logger.warn(
        `Suppressed technical proc message (${category}${oraCode ? ` ORA-${oraCode}` : ''}): ${errormessage}`,
      );
      errormessage = CATEGORY_MESSAGE[category];
      safeMessageAr = undefined;
    }

    return {
      successflag: isSuccess ? 'S' : 'N',
      status: isSuccess ? 'success' : 'error',
      errormessage,
      errormessageAr: safeMessageAr,
    };
  }
}
