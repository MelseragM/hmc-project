/**
 * Sanaad response envelopes. Success is standardized by the ResponseInterceptor;
 * failures by the exception filters. See Docs_Ai/Architecture/README.md section 4.
 */

export interface SanaadSuccessEnvelope<T = unknown> {
  result: T;
  opstatus: 0;
  status: 'success';
  httpStatusCode: number;
}

/**
 * Envelope for action/submit operations backed by Oracle `_PR`/`_PKG`.
 * `message` is `errormessage` or `errormessageAr` depending on the request's
 * `lang` (`en`/`ar`) — added so clients don't need to pick the field
 * themselves; `errormessage`/`errormessageAr` are kept for backward
 * compatibility with existing consumers.
 */
export interface SanaadActionEnvelope<T = unknown> {
  status: 'success' | 'error';
  successflag: 'S' | 'N';
  message: string;
  errormessage: string;
  errormessageAr?: string;
  httpStatusCode: number;
  result?: T;
}

/**
 * Error envelope produced by the global exception filter. The primary contract
 * is `success` + `message` + `category` (+ `errors` for validation); the legacy
 * `status`/`opstatus`/`errormessage` fields are retained for backward
 * compatibility and always carry the SAME safe message (never technical detail).
 */
export interface SanaadErrorEnvelope {
  success: false;
  message: string;
  category: string;
  errors?: Record<string, unknown>;
  httpStatusCode: number;
  correlationId?: string;
  timestamp?: string;
  path?: string;
  // ── Backward-compatible fields (safe values only) ──
  status: 'error';
  opstatus: 1;
  errormessage: string;
  errormessageAr?: string;
}

export type SanaadEnvelope<T = unknown> =
  | SanaadSuccessEnvelope<T>
  | SanaadActionEnvelope<T>
  | SanaadErrorEnvelope;
