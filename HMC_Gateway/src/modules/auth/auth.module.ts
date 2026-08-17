import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { HealthCheckController } from './healthcheck.controller';
import { ProxyCoreModule } from '../proxy/proxy-core.module';

@Module({
  imports: [ThrottlerModule, ProxyCoreModule],
  controllers: [AuthController, HealthCheckController],
})
export class AuthModule {}
