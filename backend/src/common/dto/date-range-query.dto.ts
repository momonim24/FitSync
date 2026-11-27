import { Type } from 'class-transformer';
import { IsDateOnly } from '../validators/is-date-only';
import { IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

/** ?memberId=&from=YYYY-MM-DD&to=YYYY-MM-DD plus pagination. */
export class MemberDateRangeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'memberId must be a whole number.' })
  memberId?: number;

  @IsOptional()
  @IsDateOnly({ message: 'from must be a date in YYYY-MM-DD format.' })
  from?: string;

  @IsOptional()
  @IsDateOnly({ message: 'to must be a date in YYYY-MM-DD format.' })
  to?: string;
}
