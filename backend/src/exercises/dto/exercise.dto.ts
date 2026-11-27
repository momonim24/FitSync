import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /exercises and PUT /exercises/{id} (PUT replaces all editable fields). */
export class CreateExerciseDto {
  @Transform(trim)
  @IsString({ message: 'Exercise name must be text.' })
  @IsNotEmpty({ message: 'Exercise name is required.' })
  @MaxLength(100, { message: 'Exercise name cannot exceed 100 characters.' })
  exerciseName: string;

  @Transform(trim)
  @IsString({ message: 'Category must be text.' })
  @IsNotEmpty({ message: 'Category is required.' })
  @MaxLength(100, { message: 'Category cannot exceed 100 characters.' })
  category: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Description must be text.' })
  @MaxLength(255, { message: 'Description cannot exceed 255 characters.' })
  description?: string | null;
}

export class ExerciseQueryDto extends PaginationQueryDto {
  /** Matches exercise name or description. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string;
}
