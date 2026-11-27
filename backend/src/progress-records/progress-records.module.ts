import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { ProgressRecord } from './entities/progress-record.entity';
import { ProgressRecordsController } from './progress-records.controller';
import { ProgressRecordsService } from './progress-records.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProgressRecord]), TrainerAssignmentsModule],
  controllers: [ProgressRecordsController],
  providers: [ProgressRecordsService],
})
export class ProgressRecordsModule {}
