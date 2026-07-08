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

  /** Standard OUT binds for a status flag + message returned by `_PR` procedures. */
  protected statusOutBinds(): oracledb.BindParameters {
    return {
      p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
  }

  /** A REF CURSOR OUT bind (default name `cursor`). */
  protected cursorOutBind(): oracledb.BindParameters {
    return { cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } };
  }

  /**
   * Map common OUT-bind shapes to a SubmitResult. Accepts either
   * `{ p_status, p_message }` or `{ status, msg }` style out binds.
   */
  protected toSubmitResult(out: Record<string, any>): SubmitResult {
    const flagRaw = (out.p_status ?? out.status ?? out.successflag ?? '').toString().trim();
    const message = (out.p_message ?? out.msg ?? out.errormessage ?? '').toString();
    const messageAr = out.p_message_ar ?? out.errormessage_ar;
    const isSuccess = flagRaw.toUpperCase() === 'S' || flagRaw === '0';
    return {
      successflag: isSuccess ? 'S' : 'N',
      status: isSuccess ? 'success' : 'error',
      errormessage: message || (isSuccess ? 'Success' : 'Operation failed'),
      errormessageAr: messageAr ? safeDecodeUri(messageAr) : undefined,
    };
  }
}
