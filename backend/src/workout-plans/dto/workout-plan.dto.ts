import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * POST /workout-plans and PUT /workout-plans/{id}.
 * trainerId is optional: it defaults to the logged-in trainer, and if it is
 * sent it must match the logged-in trainer (Lab 05 request body keeps it).
 */
export class CreateWorkoutPlanDto {
  @IsOptional()
  @IsInt({ message: 'trainerId must be a whole number.' })
  @IsPositive({ message: 'trainerId must be a positive number.' })
  trainerId?: number;

  @IsInt({ message: 'memberId must be a whole number.' })
  @IsPositive({ message: 'memberId must be a positive number.' })
  memberId: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Plan name must be text.' })
  @IsNotEmpty({ message: 'Plan name is required.' })
  @MaxLength(100, { message: 'Plan name cannot exceed 100 characters.' })
  planName: string;
}

export class WorkoutPlanQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'trainerId must be a whole number.' })
  trainerId?: number;
}
