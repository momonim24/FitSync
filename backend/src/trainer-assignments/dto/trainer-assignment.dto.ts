import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** POST /trainer-assignments and PUT /trainer-assignments/{id} */
export class CreateTrainerAssignmentDto {
  @IsInt({ message: 'trainerId must be a whole number.' })
  @IsPositive({ message: 'trainerId must be a positive number.' })
  trainerId: number;

  @IsInt({ message: 'memberId must be a whole number.' })
  @IsPositive({ message: 'memberId must be a positive number.' })
  memberId: number;
}

export class TrainerAssignmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'trainerId must be a whole number.' })
  trainerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;
}
