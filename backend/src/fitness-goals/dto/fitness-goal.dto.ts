import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IsDateOnly } from '../../common/validators/is-date-only';
import { GOAL_STATUSES, GOAL_TYPES, type GoalStatus, type GoalType } from '../goal-progress';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * POST /fitness-goals (Member). Type-specific rules (ranges, starting
 * weight, whole goal weeks, one active goal per type) are checked by the
 * service so the messages can explain them.
 */
export class CreateFitnessGoalDto {
  @IsIn(GOAL_TYPES, { message: 'goalType must be TargetWeight, WeeklyWorkouts or WeeklyMinutes.' })
  goalType: GoalType;

  @Transform(trim)
  @IsString({ message: 'Goal name must be text.' })
  @MinLength(3, { message: 'Goal name must be at least 3 characters.' })
  @MaxLength(100, { message: 'Goal name cannot exceed 100 characters.' })
  goalName: string;

  /** TargetWeight only: starting weight in kg. Defaults to the latest weight record on or before startDate. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'startingValue must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'startingValue must be greater than zero.' })
  @Max(9999.99, { message: 'startingValue is too large.' })
  startingValue?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetValue must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'targetValue must be greater than zero.' })
  @Max(9999.99, { message: 'targetValue is too large.' })
  targetValue: number;

  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly({ message: 'startDate must be a date in YYYY-MM-DD format.' })
  startDate?: string;

  @IsDateOnly({ message: 'targetDate must be a date in YYYY-MM-DD format.' })
  targetDate: string;
}

/** PATCH /fitness-goals/:id (Member, Active goals only). status may only be set to Cancelled. */
export class UpdateFitnessGoalDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Goal name must be text.' })
  @MinLength(3, { message: 'Goal name must be at least 3 characters.' })
  @MaxLength(100, { message: 'Goal name cannot exceed 100 characters.' })
  goalName?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'startingValue must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'startingValue must be greater than zero.' })
  @Max(9999.99, { message: 'startingValue is too large.' })
  startingValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetValue must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'targetValue must be greater than zero.' })
  @Max(9999.99, { message: 'targetValue is too large.' })
  targetValue?: number;

  @IsOptional()
  @IsDateOnly({ message: 'targetDate must be a date in YYYY-MM-DD format.' })
  targetDate?: string;

  @IsOptional()
  @IsIn(['Cancelled'], { message: 'status can only be changed to Cancelled.' })
  status?: 'Cancelled';
}

/** GET /fitness-goals?memberId=&status=&goalType=&page=&limit= */
export class FitnessGoalQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;

  @IsOptional()
  @IsIn(GOAL_STATUSES, { message: 'status must be Active, Completed, Missed or Cancelled.' })
  status?: GoalStatus;

  @IsOptional()
  @IsIn(GOAL_TYPES, { message: 'goalType must be TargetWeight, WeeklyWorkouts or WeeklyMinutes.' })
  goalType?: GoalType;
}
