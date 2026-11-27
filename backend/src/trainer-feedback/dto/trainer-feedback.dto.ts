import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FEEDBACK_TYPES, type FeedbackType } from '../entities/trainer-feedback.entity';
import { FEEDBACK_MAX_LENGTH } from '../feedback-text';

/** POST /trainer-feedback (Trainer, assigned member only). */
export class CreateTrainerFeedbackDto {
  @IsInt({ message: 'memberId must be a whole number.' })
  @IsPositive({ message: 'memberId must be a positive number.' })
  memberId: number;

  @IsOptional()
  @IsIn(FEEDBACK_TYPES, { message: 'feedbackType must be General, Encouragement, Guidance or Concern.' })
  feedbackType?: FeedbackType;

  /** Plain text; normalised by the service (length checked after normalising). */
  @IsString({ message: 'Feedback message must be text.' })
  @MaxLength(FEEDBACK_MAX_LENGTH + 200, { message: `Feedback message cannot exceed ${FEEDBACK_MAX_LENGTH} characters.` })
  feedbackMessage: string;

  @IsOptional()
  @IsInt({ message: 'relatedGoalId must be a whole number.' })
  @IsPositive({ message: 'relatedGoalId must be a positive number.' })
  relatedGoalId?: number;

  @IsOptional()
  @IsInt({ message: 'relatedPlanId must be a whole number.' })
  @IsPositive({ message: 'relatedPlanId must be a positive number.' })
  relatedPlanId?: number;
}

/** PATCH /trainer-feedback/:id (author). null clears a related goal/plan. */
export class UpdateTrainerFeedbackDto {
  @IsOptional()
  @IsIn(FEEDBACK_TYPES, { message: 'feedbackType must be General, Encouragement, Guidance or Concern.' })
  feedbackType?: FeedbackType;

  @IsOptional()
  @IsString({ message: 'Feedback message must be text.' })
  @MaxLength(FEEDBACK_MAX_LENGTH + 200, { message: `Feedback message cannot exceed ${FEEDBACK_MAX_LENGTH} characters.` })
  feedbackMessage?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt({ message: 'relatedGoalId must be a whole number.' })
  @IsPositive({ message: 'relatedGoalId must be a positive number.' })
  relatedGoalId?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt({ message: 'relatedPlanId must be a whole number.' })
  @IsPositive({ message: 'relatedPlanId must be a positive number.' })
  relatedPlanId?: number | null;
}

/** GET /trainer-feedback?memberId=&unread=&relatedGoalId=&relatedPlanId=&page=&limit= */
export class TrainerFeedbackQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'unread must be true or false.' })
  unread?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'relatedGoalId must be a whole number.' })
  relatedGoalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'relatedPlanId must be a whole number.' })
  relatedPlanId?: number;
}
