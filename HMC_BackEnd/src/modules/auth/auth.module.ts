import { Module } from '@nestjs/common';
import { AuthController } from './interface/auth.controller';
import { AuthService } from './application/auth.service';

/**
 * op-1 auth feature module. JwtService is provided globally by core AuthModule
 * (JwtModule is exported), so no local JWT wiring is needed here.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
