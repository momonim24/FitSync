import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { TrainerAssignmentsModule } from '../trainer-assignments/trainer-assignments.module';
import { WorkoutCompletionsModule } from '../workout-completions/workout-completions.module';
import { WorkoutLog } from './entities/workout-log.entity';
import { WorkoutLogsController } from './workout-logs.controller';
import { WorkoutLogsService } from './workout-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutLog, Exercise]), TrainerAssignmentsModule, WorkoutCompletionsModule],
  controllers: [WorkoutLogsController],
  providers: [WorkoutLogsService],
})
export class WorkoutLogsModule {}
