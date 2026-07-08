import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';

/**
 * Port for reading list-of-values / master-lookup reference data from any
 * allow-listed Oracle `_LOV`/`_V` object. Implemented by the infrastructure
 * adapter and bound via the LOV_REPOSITORY token.
 */
export interface LovRepository {
  readLov(object: string, lang: Lang, username?: string): Promise<LovItem[]>;
}

export const LOV_REPOSITORY = Symbol('LOV_REPOSITORY');
