import { Global, Module } from '@nestjs/common';
import { OracleService } from './oracle.service';
import { OracleLogStore } from './oracle-log.store';
import { OracleMetadataService } from './oracle-metadata.service';
import { DiagnosticsController } from './diagnostics.controller';

/**
 * Global module exposing the single OracleService pool to every data-touching
 * module (see Docs_Ai/Dependencies/README.md — OracleModule is @Global).
 * Also provides the in-memory Oracle call log + its diagnostics API.
 */
@Global()
@Module({
  controllers: [DiagnosticsController],
  providers: [OracleService, OracleLogStore, OracleMetadataService],
  exports: [OracleService, OracleLogStore, OracleMetadataService],
})
export class OracleModule {}
