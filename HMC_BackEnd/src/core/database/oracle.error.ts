import { extractOraCode } from '@shared/constants/error-codes';

/**
 * Typed wrapper around a raw node-oracledb driver error, so the
 * OracleExceptionFilter can `@Catch(OracleQueryError)` and map ORA/PLS codes
 * to the Sanaad error envelope without leaking driver types upward.
 */
export class OracleQueryError extends Error {
  readonly oraCode?: number;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OracleQueryError';
    this.oraCode = extractOraCode(message);
  }

  static from(err: unknown): OracleQueryError {
    if (err instanceof OracleQueryError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new OracleQueryError(message, err);
  }
}
