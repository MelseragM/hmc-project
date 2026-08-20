import { Global, Module } from '@nestjs/common';
import { MssqlService } from './mssql.service';

/**
 * Global module exposing the single Users/Sanaad SQL Server pool (MssqlService)
 * — the second database next to OracleModule. Backs the auth cycle
 * (device/MPIN/OTP legacy tables) and the API-1 healthcheck tables.
 */
@Global()
@Module({
  providers: [MssqlService],
  exports: [MssqlService],
})
export class MssqlModule {}
