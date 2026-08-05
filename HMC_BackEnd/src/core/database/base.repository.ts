import { NotImplementedException } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from './oracle.service';
import { SubmitResult } from '@shared/domain/submit-result';
import { safeDecodeUri } from '@shared/utils/url-decode.util';
import { ERROR_MESSAGES } from '@shared/constants/error-codes';
import { EMP_KEY_COLUMN, USERNAME_COLUMN } from '@shared/constants/oracle-columns';

/**
 * Base class for Oracle adapters. Centralizes the OUT-bind conventions
 * (`p_status` / `p_message`) so every `_PR`/`_PKG` call maps to a uniform
 * SubmitResult. Concrete repositories extend this and inject OracleService.
 *
 * See Docs_Ai/Repository Pattern/README.md (Recommendations).
 */
export abstract class BaseOracleRepository {
  constructor(protected readonly ora: OracleService) {}

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
   * Marks an adapter whose exact Oracle bind signature is not yet captured
   * (see Docs_Ai known gaps). Throws 501 until implemented.
   */
  protected notImplemented(object: string): never {
    throw new NotImplementedException(`${ERROR_MESSAGES.NOT_IMPLEMENTED} [${object}]`);
  }

  /**
   * Call a submit-style `_PR` using a FIXED named-argument list (taken from the
   * Sanaad API spec) plus the procedure's OUT binds, mapping the result to a
   * SubmitResult. Every documented param is always bound (NULL when absent from
   * `values`) so the procedure's full argument list is satisfied — omitting
   * named args raises PLS-00306.
   *
   * Two OUT conventions exist in the Sanaad procedures: the `p_status` /
   * `p_message` pair (used by the PHONE_PKG call) and the
   * `p_success_flag` / `p_error_msg` / `p_error_msg_ar` triple documented for
   * REASSIGN_PR. Pass `outBinds` to select the latter; `toSubmitResult` maps
   * both shapes.
   */
  protected async callSubmitProc(
    object: string,
    params: readonly string[],
    values: Record<string, unknown>,
    outBinds: oracledb.BindParameters = this.statusOutBinds(),
  ): Promise<SubmitResult> {
    const namedArgs = [
      ...params.map((p) => `${p} => :${p}`),
      ...Object.keys(outBinds).map((o) => `${o} => :${o}`),
    ].join(',\n          ');
    const binds: oracledb.BindParameters = { ...outBinds };
    for (const p of params) {
      (binds as Record<string, unknown>)[p] = values[p] ?? null;
    }
    const out = await this.call<Record<string, any>>(
      `BEGIN ${object}(\n          ${namedArgs}); END;`,
      binds,
    );
    return this.toSubmitResult(out);
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
    return {
      successflag: isSuccess ? 'S' : 'N',
      status: isSuccess ? 'success' : 'error',
      errormessage: message || (isSuccess ? 'Success' : 'Operation failed'),
      errormessageAr: messageAr ? safeDecodeUri(messageAr) : undefined,
    };
  }
}
