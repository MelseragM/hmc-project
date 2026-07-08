import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';

export interface DependentCommand {
  username: string;
  lang: Lang;
  fields: Record<string, unknown>;
}

export interface DeleteDependentCommand {
  username: string;
  lang: Lang;
  dependentId: string;
}

export interface PassportCommand {
  username: string;
  lang: Lang;
  fields: Record<string, unknown>;
}

/** Port: dependent add (65) / update (24) / delete (31). LOV (64) via Lookups. */
export interface DependentRepository {
  add(cmd: DependentCommand): Promise<SubmitResult>;
  update(cmd: DependentCommand): Promise<SubmitResult>;
  delete(cmd: DeleteDependentCommand): Promise<SubmitResult>;
}
export const DEPENDENT_REPOSITORY = Symbol('DEPENDENT_REPOSITORY');

/** Port: passport detail request (34). Types (33) + issue place (49) via Lookups. */
export interface PassportRepository {
  apply(cmd: PassportCommand): Promise<SubmitResult>;
}
export const PASSPORT_REPOSITORY = Symbol('PASSPORT_REPOSITORY');
