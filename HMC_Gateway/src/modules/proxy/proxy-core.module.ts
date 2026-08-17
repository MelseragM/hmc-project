import { Global, Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';

/**
 * Exposes ProxyService (the forwarding logic) app-wide WITHOUT declaring the
 * wildcard ProxyController. Kept separate from ProxyModule so other modules
 * (e.g. the auth-journey controllers) can depend on ProxyService without
 * also pulling in the `@All('*')` route.
 *
 * Note: Nest 11's RouteSpecificitySorter always registers literal routes
 * (e.g. `/auth/login`) with the underlying HTTP adapter before wildcard
 * routes, regardless of module/controller declaration order — so the split
 * here is for dependency clarity, not routing correctness. It's still
 * covered by a regression test (see test/proxy.e2e-spec.ts) in case that
 * behavior ever changes.
 */
@Global()
@Module({
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyCoreModule {}
