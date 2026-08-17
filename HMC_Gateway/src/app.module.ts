import { Module } from '@nestjs/common';
import { CoreModule } from '@core/core.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ProxyModule } from '@modules/proxy/proxy.module';

/**
 * Root module. Import order is significant: ProxyModule declares the
 * `@All('*')` catch-all and MUST be imported last so AuthModule's explicit
 * routes (the pre-login auth journey) and CoreModule's /health register
 * first — see ProxyCoreModule's doc comment.
 */
@Module({
  imports: [CoreModule, AuthModule, ProxyModule],
})
export class AppModule {}
