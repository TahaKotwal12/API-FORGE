import { Module } from '@nestjs/common';
import { LinterController } from './linter.controller';
import { LinterService } from './linter.service';
import { SpecModule } from '../spec/spec.module';

@Module({
  imports: [SpecModule],
  controllers: [LinterController],
  providers: [LinterService],
})
export class LinterModule {}
