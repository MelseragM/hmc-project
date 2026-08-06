import { Logger, NotImplementedException } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from './oracle.service';
import { OracleSchemaService } from './oracle-schema.service';
import { SubmitResult } from '@shared/domain/submit-result';
import { safeDecodeUri } from '@shared/utils/url-decode.util';
import { ERROR_MESSAGES } from '@shared/constants/error-codes';
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
    const declared = await this.schema?.resolveParams(object);
    const binds: oracledb.BindParameters = {};
    const names: string[] = [];

    if (declared?.length) {
      for (const param of declared) {
        names.push(param.name);
        (binds as Record<string, unknown>)[param.name] = param.direction.includes('OUT')
          ? { dir: oracledb.BIND_OUT, type: OracleSchemaService.outBindType(param.dataType), maxSize: 4000 }
          : BaseOracleRepository.pick(values, param.name);
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
    const declared = await this.schema?.resolveParams(object);
    const inParams = declared?.length
      ? declared.filter((p) => !p.direction.includes('OUT')).map((p) => p.name)
      : [...params];
    const cursorName =
      declared?.find((p) => p.direction.includes('OUT') && p.dataType.toUpperCase() === 'REF CURSOR')
        ?.name ?? cursorParam;

    const binds: oracledb.BindParameters = { ...this.cursorOutBind() };
    for (const p of inParams) {
      (binds as Record<string, unknown>)[p] = BaseOracleRepository.pick(values, p);
    }

    const namedArgs = [...inParams.map((p) => `${p} => :${p}`), `${cursorName} => :cursor`].join(
      ',\n          ',
    );
    return this.callCursor<T>(`BEGIN ${object}(\n          ${namedArgs}); END;`, binds);
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

  /** `p_file_name1..N` / `p_attachment1..N` slot names shared by submit procs. */
  static attachmentParams(n = 10): string[] {
    const slots: string[] = [];
    for (let i = 1; i <= n; i++) slots.push(`p_file_name${i}`, `p_attachment${i}`);
    return slots;
  }

  /** Standard OUT binds for a status flag + message returned by `_PR` procedures. */
  protected statusOutBinds(): oracledb.BindParameters {
    return {
      p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
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
    const flagRaw = (out.p_status ?? out.p_success_flag ?? out.status ?? out.successflag ?? '')
      .toString()
      .trim();
    const message = (out.p_message ?? out.p_error_msg ?? out.msg ?? out.errormessage ?? '').toString();
    const messageAr = out.p_message_ar ?? out.p_error_msg_ar ?? out.errormessage_ar;
    const isSuccess = flagRaw.toUpperCase() === 'S' || flagRaw === '0';
    let errormessage = message || (isSuccess ? 'Success' : 'Operation failed');
    let safeMessageAr = messageAr ? safeDecodeUri(messageAr) : undefined;

    // This channel (op result, HTTP 200) bypasses the exception filter, so an
    // Oracle proc surfacing an ORA-/PLS- error or SQL text in p_message must be
    // sanitized here too — never forward technical detail to the client.
    if (!isSuccess && looksSensitive(errormessage)) {
      this.logger.warn(`Suppressed technical proc message: ${errormessage}`);
      errormessage = CATEGORY_MESSAGE[ErrorCategory.DATABASE_ERROR];
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
