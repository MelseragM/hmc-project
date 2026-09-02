import { DeviceToken } from '../device-token';

/**
 * Persistence for FCM registration tokens.
 *
 * A port rather than a repository class so the store can move — today the
 * Sanaad SQL Server, next to the device-binding table it is keyed the same way
 * as — without the sending side knowing.
 */
export interface DeviceTokenStorePort {
  /** Register or replace the token of one device. */
  save(token: DeviceToken): Promise<void>;

  /** Every live token for a user — a user may have more than one device. */
  findByUsername(username: string): Promise<DeviceToken[]>;

  /**
   * Forget one device's token, on logout or when FCM reports it dead.
   * Silently does nothing when there is no such row.
   */
  remove(username: string, imei: string): Promise<void>;

  /**
   * Drop tokens FCM has rejected as permanently invalid, whoever owns them.
   * Keeping them would mean re-sending to the same dead devices on every
   * notification and reading the failures as if they meant something.
   */
  removeTokens(tokens: readonly string[]): Promise<void>;
}

export const DEVICE_TOKEN_STORE_PORT = Symbol('DEVICE_TOKEN_STORE_PORT');
