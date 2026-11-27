/** Formatting shared by the PDF and Excel exports (same text in both files). */
import { DISPLAY_TIME_ZONE, TIME_ZONE_LABEL } from '../lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' (or an ISO timestamp) -> '26 Nov 2026'. Unambiguous in every locale. */
export function longDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM' -> 'Nov 2026' */
export function monthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM-DD' -> '26 Nov' (chart axes). */
export function shortDay(value: string): string {
  const [, m, d] = value.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Date and time in the FitSync time zone, e.g. '26 Nov 2026, 14:05 PHT' (same on every computer). */
export function dateTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}, ${parts.hour}:${parts.minute} ${TIME_ZONE_LABEL}`;
}

/** 'YYYY-MM-DD' -> Date at UTC midnight (Excel stores dates without a time zone). */
export function utcDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function int(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function dec1(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function minutesText(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function signedKg(n: number | null): string {
  if (n === null) return '—';
  return `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

/** Safe file name part. */
export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40) || 'report';
}
