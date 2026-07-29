import { Injectable, NotImplementedException } from '@nestjs/common';
import { FunctionAccessPort } from '../../domain/ports/function-access.port';
import { FunctionAccess } from '../../domain/auth-identity';

/**
 * Stub function-access resolver. Throws 501 until the HR/Oracle mapping of
 * employee → enabled function codes is provided. In non-production the
 * LoginService uses a static dev list instead of this adapter (dev bypass).
 * TODO(spec): implement against the function-access source (login API-5).
 */
@Injectable()
export class FunctionAccessStubRepository implements FunctionAccessPort {
  list(_employeeNumber: string): Promise<FunctionAccess[]> {
    throw new NotImplementedException(
      'Function-access list is not wired yet — provide the employee→functions source. [TODO(spec) API-5]',
    );
  }
}
