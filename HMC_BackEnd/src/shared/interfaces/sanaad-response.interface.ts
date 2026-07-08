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

/** Envelope for action/submit operations backed by Oracle `_PR`/`_PKG`. */
export interface SanaadActionEnvelope<T = unknown> {
  status: 'success' | 'error';
  successflag: 'S' | 'N';
  errormessage: string;
  errormessageAr?: string;
  httpStatusCode: number;
  result?: T;
}

export interface SanaadErrorEnvelope {
  status: 'error';
  opstatus: 1;
  errormessage: string;
  errormessageAr?: string;
  httpStatusCode: number;
  path?: string;
  correlationId?: string;
  timestamp?: string;
}

export type SanaadEnvelope<T = unknown> =
  | SanaadSuccessEnvelope<T>
  | SanaadActionEnvelope<T>
  | SanaadErrorEnvelope;
