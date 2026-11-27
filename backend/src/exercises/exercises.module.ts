import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { Exercise } from './entities/exercise.entity';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, WorkoutLog, PlanExercise])],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
