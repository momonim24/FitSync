import { Transform } from 'class-transformer';
import { IsDateOnly } from '../../common/validators/is-date-only';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, ValidateIf } from 'class-validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /progress-records (Lab 05 #11). memberId defaults to the logged-in member. */
export class CreateProgressRecordDto {
  @IsOptional()
  @IsInt({ message: 'memberId must be a whole number.' })
  @IsPositive({ message: 'memberId must be a positive number.' })
  memberId?: number;

  @IsDateOnly({ message: 'Record date must be in YYYY-MM-DD format.' })
  @IsNotFutureDate({ message: 'Record date cannot be in the future.' })
  recordDate: string;

  /** DECIMAL(5,2): greater than zero, at most 999.99, two decimal places. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Weight must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'Weight must be greater than zero.' })
  @Max(999.99, { message: 'Weight cannot exceed 999.99 kg.' })
  weightKg?: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Notes must be text.' })
  @MaxLength(255, { message: 'Notes cannot exceed 255 characters.' })
  notes?: string | null;
}

/** PATCH /progress-records/{id} */
export class UpdateProgressRecordDto {
  @IsOptional()
  @IsDateOnly({ message: 'Record date must be in YYYY-MM-DD format.' })
  @IsNotFutureDate({ message: 'Record date cannot be in the future.' })
  recordDate?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Weight must be a number with at most 2 decimal places.' })
  @IsPositive({ message: 'Weight must be greater than zero.' })
  @Max(999.99, { message: 'Weight cannot exceed 999.99 kg.' })
  weightKg?: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Notes must be text.' })
  @MaxLength(255, { message: 'Notes cannot exceed 255 characters.' })
  notes?: string | null;
}
