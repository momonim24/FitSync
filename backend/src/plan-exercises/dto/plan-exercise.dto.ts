import { IsInt, IsOptional, IsPositive, Max, ValidateIf } from 'class-validator';

/** POST /plan-exercises (Lab 05 #14). */
export class CreatePlanExerciseDto {
  @IsInt({ message: 'planId must be a whole number.' })
  @IsPositive({ message: 'planId must be a positive number.' })
  planId: number;

  @IsInt({ message: 'exerciseId must be a whole number.' })
  @IsPositive({ message: 'exerciseId must be a positive number.' })
  exerciseId: number;

  @IsInt({ message: 'Target sets must be a whole number.' })
  @IsPositive({ message: 'Target sets must be greater than zero.' })
  @Max(100, { message: 'Target sets cannot exceed 100.' })
  targetSets: number;

  /** Required for repetition-based exercises; optional (stored as 1, unused) when targetDurationMinutes is set. */
  @ValidateIf((o: CreatePlanExerciseDto) => o.targetDurationMinutes === undefined || o.targetDurationMinutes === null || o.targetReps !== undefined)
  @IsInt({ message: 'Target reps must be a whole number.' })
  @IsPositive({ message: 'Target reps must be greater than zero.' })
  @Max(1000, { message: 'Target reps cannot exceed 1000.' })
  targetReps: number;

  /** Version 2.0 (migration 003): total minutes for a timed exercise. */
  @IsOptional()
  @IsInt({ message: 'Target duration must be a whole number of minutes.' })
  @IsPositive({ message: 'Target duration must be greater than zero.' })
  @Max(600, { message: 'Target duration cannot exceed 600 minutes.' })
  targetDurationMinutes?: number;
}

/** PATCH /plan-exercises/{id} — change the targets. */
export class UpdatePlanExerciseDto {
  @IsOptional()
  @IsInt({ message: 'Target sets must be a whole number.' })
  @IsPositive({ message: 'Target sets must be greater than zero.' })
  @Max(100, { message: 'Target sets cannot exceed 100.' })
  targetSets?: number;

  @IsOptional()
  @IsInt({ message: 'Target reps must be a whole number.' })
  @IsPositive({ message: 'Target reps must be greater than zero.' })
  @Max(1000, { message: 'Target reps cannot exceed 1000.' })
  targetReps?: number;

  /** Minutes for a timed exercise; null switches back to repetition-based. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Target duration must be a whole number of minutes.' })
  @IsPositive({ message: 'Target duration must be greater than zero.' })
  @Max(600, { message: 'Target duration cannot exceed 600 minutes.' })
  targetDurationMinutes?: number | null;
}
