import { Module } from '@nestjs/common';
import { LookupsModule } from '@lookups/lookups.module';
import { ProfileController } from './interface/profile.controller';
import { ProfileService } from './application/profile.service';
import { PROFILE_REPOSITORY } from './domain/profile.repository';
import { ProfileOracleRepository } from './infrastructure/oracle/profile.oracle.repository';

@Module({
  imports: [LookupsModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    { provide: PROFILE_REPOSITORY, useClass: ProfileOracleRepository },
  ],
})
export class ProfileModule {}
