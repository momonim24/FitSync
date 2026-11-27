import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { MemberDateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { IsDateOnly } from '../../common/validators/is-date-only';

/** POST /workout-completions — count an already recorded workout toward a plan exercise. */
export class CreateWorkoutCompletionDto {
  @IsInt({ message: 'logId must be a whole number.' })
  @IsPositive({ message: 'logId must be a positive number.' })
  logId: number;

  @IsInt({ message: 'planExerciseId must be a whole number.' })
  @IsPositive({ message: 'planExerciseId must be a positive number.' })
  planExerciseId: number;
}

/** GET /workout-completions?memberId=&planId=&from=&to=&page=&limit= (completion history). */
export class WorkoutCompletionQueryDto extends MemberDateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'planId must be a whole number.' })
  planId?: number;
}

export const COMPLETION_PERIODS = ['week', 'month', 'custom'] as const;

/**
 * ?period=week|month|custom&from=&to= for completion summaries.
 *   week   = the last 7 days including today (default)
 *   month  = the last 30 days including today
 *   custom = from..to inclusive (at most 366 days)
 */
export class CompletionPeriodQueryDto {
  @IsOptional()
  @IsIn(COMPLETION_PERIODS, { message: 'period must be week, month or custom.' })
  period?: (typeof COMPLETION_PERIODS)[number];

  @IsOptional()
  @IsDateOnly({ message: 'from must be a date in YYYY-MM-DD format.' })
  from?: string;

  @IsOptional()
  @IsDateOnly({ message: 'to must be a date in YYYY-MM-DD format.' })
  to?: string;
}

/** GET /workout-completions/adherence?memberId=&period=&from=&to= */
export class AdherenceQueryDto extends CompletionPeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;
}
