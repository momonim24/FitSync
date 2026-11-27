import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { User } from '../users/entities/user.entity';
import { WorkoutPlan } from './entities/workout-plan.entity';
import { WorkoutPlansController } from './workout-plans.controller';
import { WorkoutPlansService } from './workout-plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutPlan, User]), TrainerAssignmentsModule],
  controllers: [WorkoutPlansController],
  providers: [WorkoutPlansService],
  exports: [WorkoutPlansService],
})
export class WorkoutPlansModule {}
