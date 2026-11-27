import { IsIn, IsOptional } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only';

export const REPORT_PERIODS = ['week', 'month', 'custom'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * ?period=week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
 *
 * - week   = the last 7 days including today
 * - month  = the last 30 days including today (default)
 * - custom = from..to inclusive (both required, at most 366 days)
 * Sending from/to without a period implies "custom".
 */
export class ReportQueryDto {
  @IsOptional()
  @IsIn(REPORT_PERIODS, { message: 'period must be week, month or custom.' })
  period?: ReportPeriod;

  @IsOptional()
  @IsDateOnly({ message: 'from must be a date in YYYY-MM-DD format.' })
  from?: string;

  @IsOptional()
  @IsDateOnly({ message: 'to must be a date in YYYY-MM-DD format.' })
  to?: string;

  @IsOptional()
  @IsIn(['json', 'csv'], { message: 'format must be json or csv.' })
  format?: 'json' | 'csv';
}
