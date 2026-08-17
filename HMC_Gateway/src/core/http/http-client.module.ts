import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BackendConfig } from '../config/configuration';

/**
 * Single shared axios HttpService, configured with the backend's base URL
 * and timeout, used by both ProxyService (generic forwarding) and the
 * auth-proxy controller (pre-login journey) and HealthController.
 */
@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const backend = config.getOrThrow<BackendConfig>('backend');
        return {
          baseURL: backend.baseUrl,
          timeout: backend.timeoutMs,
          validateStatus: () => true, // let ProxyService/callers see all statuses, not just 2xx
        };
      },
    }),
  ],
  exports: [HttpModule],
})
export class HttpClientModule {}
