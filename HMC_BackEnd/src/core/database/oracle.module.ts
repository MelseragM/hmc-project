import { Global, Module } from '@nestjs/common';
import { OracleService } from './oracle.service';

/**
 * Global module exposing the single OracleService pool to every data-touching
 * module (see Docs_Ai/Dependencies/README.md — OracleModule is @Global).
 */
@Global()
@Module({
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
