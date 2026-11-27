import { Type } from 'class-transformer';
import { IsDateOnly } from '../../common/validators/is-date-only';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { MemberDateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date';

/** POST /workout-logs (Lab 05 #9). memberId defaults to the logged-in member. */
export class CreateWorkoutLogDto {
  @IsOptional()
  @IsInt({ message: 'memberId must be a whole number.' })
  @IsPositive({ message: 'memberId must be a positive number.' })
  memberId?: number;

  @IsInt({ message: 'exerciseId must be a whole number.' })
  @IsPositive({ message: 'exerciseId must be a positive number.' })
  exerciseId: number;

  @IsDateOnly({ message: 'Workout date must be in YYYY-MM-DD format.' })
  @IsNotFutureDate({ message: 'Workout date cannot be in the future.' })
  workoutDate: string;

  @IsInt({ message: 'Sets must be a whole number.' })
  @Min(1, { message: 'Sets must be greater than zero.' })
  @Max(100, { message: 'Sets cannot exceed 100.' })
  sets: number;

  @IsInt({ message: 'Repetitions must be a whole number.' })
  @Min(0, { message: 'Repetitions cannot be negative.' })
  @Max(10000, { message: 'Repetitions cannot exceed 10000.' })
  repetitions: number;

  @IsInt({ message: 'Duration must be a whole number of minutes.' })
  @Min(0, { message: 'Duration cannot be negative.' })
  @Max(1440, { message: 'Duration cannot exceed 1440 minutes (24 hours).' })
  durationMinutes: number;

  /**
   * Version 2.0 (optional): log this workout FROM an assigned plan. The
   * workout is saved and counted toward that plan exercise in one
   * transaction. The plan must be the member's own and prescribe exerciseId.
   */
  @IsOptional()
  @IsInt({ message: 'planExerciseId must be a whole number.' })
  @IsPositive({ message: 'planExerciseId must be a positive number.' })
  planExerciseId?: number;
}

/** PATCH /workout-logs/{id} — any subset of the editable fields. */
export class UpdateWorkoutLogDto {
  @IsOptional()
  @IsInt({ message: 'exerciseId must be a whole number.' })
  @IsPositive({ message: 'exerciseId must be a positive number.' })
  exerciseId?: number;

  @IsOptional()
  @IsDateOnly({ message: 'Workout date must be in YYYY-MM-DD format.' })
  @IsNotFutureDate({ message: 'Workout date cannot be in the future.' })
  workoutDate?: string;

  @IsOptional()
  @IsInt({ message: 'Sets must be a whole number.' })
  @Min(1, { message: 'Sets must be greater than zero.' })
  @Max(100, { message: 'Sets cannot exceed 100.' })
  sets?: number;

  @IsOptional()
  @IsInt({ message: 'Repetitions must be a whole number.' })
  @Min(0, { message: 'Repetitions cannot be negative.' })
  @Max(10000, { message: 'Repetitions cannot exceed 10000.' })
  repetitions?: number;

  @IsOptional()
  @IsInt({ message: 'Duration must be a whole number of minutes.' })
  @Min(0, { message: 'Duration cannot be negative.' })
  @Max(1440, { message: 'Duration cannot exceed 1440 minutes (24 hours).' })
  durationMinutes?: number;
}

/** GET /workout-logs?memberId=&exerciseId=&from=&to=&page=&limit= */
export class WorkoutLogQueryDto extends MemberDateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'exerciseId must be a whole number.' })
  exerciseId?: number;
}
