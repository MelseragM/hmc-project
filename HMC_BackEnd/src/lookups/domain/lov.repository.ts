import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';

/**
 * Port for reading list-of-values / master-lookup reference data from any
 * allow-listed Oracle `_LOV`/`_V` object. Implemented by the infrastructure
 * adapter and bound via the LOV_REPOSITORY token.
 */
export interface LovReadOptions {
  search?: string;
  offset?: number;
  limit?: number;
  dataType?: string;
  /**
   * Equality filter on the LOV's leave-type column (ABSENCE_REASON_V exposes
   * `LEAVE_TYPE`) — e.g. `Compassionate Leave` returns only that type's
   * reasons. Ignored when the object has no such column.
   */
  leaveType?: string;
}

export interface LovRepository {
  readLov(
    object: string,
    lang: Lang,
    username?: string,
    options?: LovReadOptions,
  ): Promise<LovItem[]>;
}

export const LOV_REPOSITORY = Symbol('LOV_REPOSITORY');
