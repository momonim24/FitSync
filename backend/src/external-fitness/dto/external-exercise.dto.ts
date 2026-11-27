import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** GET /external-fitness/exercises — browse/search the wger catalog. */
export class ExternalExerciseQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'search must be text.' })
  @MinLength(2, { message: 'search must be at least 2 characters.' })
  @MaxLength(100, { message: 'search cannot exceed 100 characters.' })
  search?: string;

  /** wger category ID (see GET /external-fitness/categories). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'category must be a whole number.' })
  @IsPositive({ message: 'category must be a positive number.' })
  category?: number;

  /** wger equipment ID (see GET /external-fitness/equipment). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'equipment must be a whole number.' })
  @IsPositive({ message: 'equipment must be a positive number.' })
  equipment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number.' })
  @Min(1, { message: 'page must be at least 1.' })
  @Max(500, { message: 'page cannot exceed 500.' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(50, { message: 'limit cannot exceed 50.' })
  limit: number = 12;
}
