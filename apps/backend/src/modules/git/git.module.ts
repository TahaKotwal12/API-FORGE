import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CommitsService } from './commits.service';
import { MergeRequestsService } from './merge-requests.service';
import { BranchesController, CommitsController, MergeRequestsController, GitConfigController } from './git.controller';
import { SpecModule } from '../spec/spec.module';

@Module({
  imports: [SpecModule],
  controllers: [BranchesController, CommitsController, MergeRequestsController, GitConfigController],
  providers: [BranchesService, CommitsService, MergeRequestsService],
  exports: [CommitsService],
})
export class GitModule {}
