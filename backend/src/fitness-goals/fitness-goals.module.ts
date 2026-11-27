import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { FitnessGoal } from './entities/fitness-goal.entity';
import { FitnessGoalsController } from './fitness-goals.controller';
import { FitnessGoalsService } from './fitness-goals.service';

@Module({
  imports: [TypeOrmModule.forFeature([FitnessGoal, ProgressRecord, WorkoutLog]), TrainerAssignmentsModule],
  controllers: [FitnessGoalsController],
  providers: [FitnessGoalsService],
  // Used by trainer feedback (goal ownership), dashboards and reports.
  exports: [FitnessGoalsService],
})
export class FitnessGoalsModule {}
