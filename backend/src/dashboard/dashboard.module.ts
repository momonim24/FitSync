import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FitnessGoalsModule } from '../fitness-goals/fitness-goals.module';
import { TrainerFeedbackModule } from '../trainer-feedback/trainer-feedback.module';
import { WorkoutCompletionsModule } from '../workout-completions/workout-completions.module';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { DashboardFitnessService } from './dashboard-fitness.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Exercise, WorkoutLog, WorkoutPlan, ProgressRecord, TrainerAssignment]),
    // Version 2.0: fitness management data shown on the dashboards
    WorkoutCompletionsModule,
    FitnessGoalsModule,
    TrainerFeedbackModule,
    TrainerAssignmentsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardFitnessService],
})
export class DashboardModule {}
