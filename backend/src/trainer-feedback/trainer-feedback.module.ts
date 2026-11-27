import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FitnessGoalsModule } from '../fitness-goals/fitness-goals.module';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { User } from '../users/entities/user.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { TrainerFeedback } from './entities/trainer-feedback.entity';
import { TrainerFeedbackController } from './trainer-feedback.controller';
import { TrainerFeedbackService } from './trainer-feedback.service';

@Module({
  imports: [TypeOrmModule.forFeature([TrainerFeedback, User, WorkoutPlan]), TrainerAssignmentsModule, FitnessGoalsModule],
  controllers: [TrainerFeedbackController],
  providers: [TrainerFeedbackService],
  // Used by the dashboards and reports for counts.
  exports: [TrainerFeedbackService],
})
export class TrainerFeedbackModule {}
