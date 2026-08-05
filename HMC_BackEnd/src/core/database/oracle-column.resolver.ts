import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OracleMetadataService } from './oracle-metadata.service';

/**
 * Resolves which of several candidate key columns a view actually exposes.
 *
 * The Sanaad specification documents the *request parameter* names of the legacy
 * services (`USER_NAME`, `EMPLOYEE_NUMBER`, ...) but not the column names of the
 * underlying `XXHMC_SND_*` views, and the two do not always match — assuming one
 * produced `ORA-00904: invalid identifier` on several endpoints. Instead of
 * hard-coding a guess, adapters declare the plausible candidates (most specific
 * first) and the real column is read once from the data dictionary and cached for
 * the process lifetime.
 */
@Injectable()
export class OracleColumnResolver {
  private readonly logger = new Logger(OracleColumnResolver.name);
  /** object → upper-cased column names. */
  private readonly columns = new Map<string, Set<string>>();

  constructor(private readonly metadata: OracleMetadataService) {}

  /**
   * Returns the first candidate that exists on `object`. Falls back to the first
   * candidate when the dictionary lookup yields nothing (e.g. the account cannot
   * read ALL_TAB_COLUMNS) so behaviour stays unchanged rather than breaking.
   */
  async resolveKeyColumn(object: string, candidates: readonly string[]): Promise<string> {
    const available = await this.columnsOf(object);
    if (!available.size) return candidates[0];

    const match = candidates.find((c) => available.has(c.toUpperCase()));
    if (match) return match;

    throw new ServiceUnavailableException(
      `None of the expected key columns [${candidates.join(', ')}] exist on ${object}. ` +
        `Available columns: ${[...available].join(', ')}.`,
    );
  }

  /** True when `object` exposes `column`. */
  async hasColumn(object: string, column: string): Promise<boolean> {
    const available = await this.columnsOf(object);
    return available.has(column.toUpperCase());
  }

  private async columnsOf(object: string): Promise<Set<string>> {
    const key = object.toUpperCase();
    const cached = this.columns.get(key);
    if (cached) return cached;

    let names = new Set<string>();
    try {
      const described = await this.metadata.describe(object);
      names = new Set(described.columns.map((c) => c.name.toUpperCase()));
    } catch (err) {
      this.logger.warn(`Could not describe ${object}: ${(err as Error).message}`);
    }
    this.columns.set(key, names);
    return names;
  }
}
