import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { WorkoutPlansModule } from '../workout-plans/workout-plans.module';
import { WorkoutCompletion } from './entities/workout-completion.entity';
import { PlanCompletionController, WorkoutCompletionsController } from './workout-completions.controller';
import { WorkoutCompletionsService } from './workout-completions.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutCompletion, WorkoutLog, PlanExercise, WorkoutPlan, User]), TrainerAssignmentsModule, WorkoutPlansModule],
  controllers: [WorkoutCompletionsController, PlanCompletionController],
  providers: [WorkoutCompletionsService],
  // Used by workout logs (link on create, reconcile on update), dashboards and reports.
  exports: [WorkoutCompletionsService],
})
export class WorkoutCompletionsModule {}
