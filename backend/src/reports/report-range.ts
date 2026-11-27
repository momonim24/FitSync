import { badRequest } from '../common/utils/http-errors';
import { daysFromToday } from '../common/utils/date.util';
import { ReportPeriod, ReportQueryDto } from './dto/report-query.dto';

export const MAX_REPORT_DAYS = 366;

export interface ReportRange {
  period: ReportPeriod;
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive, YYYY-MM-DD
  days: number;
}

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Number of calendar days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;
}

/** Every date from `from` to `to` inclusive. */
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = toUtc(from); t <= toUtc(to); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Turns the query into a validated inclusive date range (400 with a clear message otherwise). */
export function resolveRange(query: ReportQueryDto): ReportRange {
  const today = daysFromToday(0);
  const period: ReportPeriod = query.period ?? (query.from || query.to ? 'custom' : 'month');

  if (period !== 'custom') {
    if (query.from || query.to) {
      throw badRequest('Invalid report range.', 'from and to can only be used with period=custom.');
    }
    const days = period === 'week' ? 7 : 30;
    return { period, from: daysFromToday(-(days - 1)), to: today, days };
  }

  if (!query.from || !query.to) {
    throw badRequest('Invalid report range.', 'A custom report needs both from and to dates.');
  }
  if (query.from > query.to) {
    throw badRequest('Invalid report range.', 'from must be on or before to.');
  }
  if (query.to > today) {
    throw badRequest('Invalid report range.', 'to cannot be in the future.');
  }
  const days = daysBetween(query.from, query.to);
  if (days > MAX_REPORT_DAYS) {
    throw badRequest('Invalid report range.', `A report can cover at most ${MAX_REPORT_DAYS} days.`);
  }
  return { period, from: query.from, to: query.to, days };
}
