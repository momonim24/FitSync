import { Module } from '@nestjs/common';
import { FitnessGoalsModule } from '../fitness-goals/fitness-goals.module';
import { TrainerFeedbackModule } from '../trainer-feedback/trainer-feedback.module';
import { WorkoutCompletionsModule } from '../workout-completions/workout-completions.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WorkoutLog, ProgressRecord, WorkoutPlan, TrainerAssignment, Exercise]),
    TrainerAssignmentsModule,
    // Version 2.0 report sections
    WorkoutCompletionsModule,
    FitnessGoalsModule,
    TrainerFeedbackModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
