import { Module } from '@nestjs/common';
import { ProxyCoreModule } from './proxy-core.module';
import { ProxyController } from './proxy.controller';

/**
 * Declares ONLY the wildcard `@All('*')` route. Must be imported LAST in
 * AppModule so every explicit controller (auth journey, health) registers
 * its routes first — see ProxyCoreModule's doc comment for why this matters.
 */
@Module({
  imports: [ProxyCoreModule],
  controllers: [ProxyController],
})
export class ProxyModule {}
