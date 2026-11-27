import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { WorkoutPlansModule } from '../workout-plans/workout-plans.module';
import { PlanExercise } from './entities/plan-exercise.entity';
import { PlanExercisesController } from './plan-exercises.controller';
import { PlanExercisesService } from './plan-exercises.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanExercise, WorkoutPlan, Exercise]), WorkoutPlansModule],
  controllers: [PlanExercisesController],
  providers: [PlanExercisesService],
})
export class PlanExercisesModule {}
