import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Entry } from 'ldapts';
import { Role } from '@core/auth/auth-user.interface';
import { LdapConfig } from '@core/config/configuration';
import {
  AuthenticateUserQuery,
  LdapUserPort,
  ValidateUserQuery,
} from '../../domain/ports/ldap-user.port';
import { EmployeeIdentity } from '../../domain/auth-identity';

/** AD attributes read to build the EmployeeIdentity. */
const USER_ATTRIBUTES = [
  'sAMAccountName',
  'userPrincipalName',
  'displayName',
  'cn',
  'givenName',
  'sn',
  'mail',
  'mobile',
  'telephoneNumber',
  'employeeID',
  'department',
  'company',
];

/**
 * Real Active Directory / LDAP adapter (ldapts, LDAPS on 636).
 *  - `validate`     → service-account bind, search `(sAMAccountName={username})`,
 *                     map attributes to EmployeeIdentity (no password).
 *  - `authenticate` → service search to find the user's DN, then bind AS that DN
 *                     with the supplied password to verify AD credentials (API-2
 *                     onboarding). Login (API-5) stays MPIN-based.
 *
 * Requires a service/bind account (LDAP_BIND_DN / LDAP_BIND_PASSWORD) to search.
 */
@Injectable()
export class LdapUserRepository implements LdapUserPort {
  private readonly logger = new Logger(LdapUserRepository.name);
  private readonly cfg: LdapConfig;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<LdapConfig>('ldap');
  }

  async validate(query: ValidateUserQuery): Promise<EmployeeIdentity> {
    this.ensureEnabled();
    const client = this.createClient();
    try {
      await this.bindService(client);
      const entry = await this.searchUser(client, query.username);
      return this.toIdentity(query.username, entry);
    } catch (err) {
      throw this.wrap(err);
    } finally {
      await this.safeUnbind(client);
    }
  }

  async authenticate(query: AuthenticateUserQuery): Promise<EmployeeIdentity> {
    this.ensureEnabled();
    if (!query.password) {
      throw new UnauthorizedException('Invalid username or password.');
    }
    const serviceClient = this.createClient();
    try {
      await this.bindService(serviceClient);
      const entry = await this.searchUser(serviceClient, query.username);
      if (!entry) {
        throw new UnauthorizedException('Invalid username or password.');
      }
      await this.verifyPassword(entry.dn, query.password);
      return this.toIdentity(query.username, entry);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw this.wrap(err);
    } finally {
      await this.safeUnbind(serviceClient);
    }
  }

  /** Bind as the resolved user DN to verify the AD password, then unbind. */
  private async verifyPassword(userDn: string, password: string): Promise<void> {
    const userClient = this.createClient();
    try {
      await userClient.bind(userDn, password);
    } catch {
      throw new UnauthorizedException('Invalid username or password.');
    } finally {
      await this.safeUnbind(userClient);
    }
  }

  private createClient(): Client {
    return new Client({
      url: this.cfg.url,
      timeout: this.cfg.timeoutMs,
      connectTimeout: this.cfg.timeoutMs,
      tlsOptions: this.cfg.useSsl
        ? { rejectUnauthorized: this.cfg.tlsRejectUnauthorized }
        : undefined,
    });
  }

  private ensureEnabled(): void {
    if (!this.cfg.enabled) {
      throw new ServiceUnavailableException(
        'LDAP is disabled — set LDAP_ENABLED=true to use directory authentication.',
      );
    }
  }

  private async bindService(client: Client): Promise<void> {
    if (!this.cfg.bindDn) {
      throw new ServiceUnavailableException(
        'LDAP bind account is not configured (LDAP_BIND_DN / LDAP_BIND_PASSWORD).',
      );
    }
    await client.bind(this.cfg.bindDn, this.cfg.bindPassword);
  }

  private async searchUser(client: Client, username: string): Promise<Entry | undefined> {
    const { searchEntries } = await client.search(this.cfg.baseDn, {
      scope: 'sub',
      filter: this.buildFilter(username),
      sizeLimit: 1,
      attributes: USER_ATTRIBUTES,
    });
    return searchEntries[0];
  }

  private buildFilter(username: string): string {
    return this.cfg.searchFilter.replace('{username}', this.escapeFilter(username));
  }

  /** RFC 4515 escaping to prevent LDAP search-filter injection. */
  private escapeFilter(value: string): string {
    return value.replace(
      /[\\*()\0]/g,
      (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`,
    );
  }

  private toIdentity(username: string, entry?: Entry): EmployeeIdentity {
    const read = (name: string): string | undefined => {
      const raw = entry?.[name];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value === undefined || value === null) return undefined;
      return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
    };
    return {
      username: read(this.cfg.usernameAttribute) ?? username,
      employeeNumber: read('employeeID'),
      employeeName: read('displayName') ?? read('cn'),
      department: read('department'),
      company: read('company'),
      phoneNumber: read('mobile') ?? read('telephoneNumber'),
      isEmployee: entry !== undefined,
      // MPIN existence is owned by the MPIN store, not the directory.
      isNewUser: false,
      roles: [Role.EMPLOYEE],
    };
  }

  private wrap(err: unknown): Error {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`LDAP operation failed: ${message}`);
    return new ServiceUnavailableException(`LDAP directory error: ${message}`);
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch (err) {
      this.logger.warn(`LDAP unbind failed: ${(err as Error).message}`);
    }
  }
}
