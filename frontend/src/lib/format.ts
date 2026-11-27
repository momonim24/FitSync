/** Display helpers shared across pages. */

/*
 * TIME ZONES. The API returns instants (createdAt, readAt, …) as UTC ISO
 * strings; they are always DISPLAYED in the FitSync time zone (Asia/Manila
 * by default, VITE_DISPLAY_TIME_ZONE to change it), not in whatever zone the
 * viewer's computer uses. Calendar dates ('YYYY-MM-DD': workout dates, record
 * dates, report ranges) have no time zone and are shown as they are.
 */
export const DISPLAY_TIME_ZONE: string = import.meta.env.VITE_DISPLAY_TIME_ZONE || 'Asia/Manila';
/** Short label shown next to times, e.g. "PHT" for Asia/Manila. */
export const TIME_ZONE_LABEL = DISPLAY_TIME_ZONE === 'Asia/Manila' ? 'PHT' : DISPLAY_TIME_ZONE;

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** The FitSync-time-zone calendar day of an instant, as 'YYYY-MM-DD'. */
export function dateOfInstant(value: string | Date): string {
  return ymd.format(new Date(value));
}

/** 'YYYY-MM-DD' -> 'Nov 26, 2026' (parsed as a local calendar date, no timezone shift). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 'YYYY-MM-DD' -> 'Nov 26' for chart axes. */
export function shortDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** UTC ISO instant -> 'Nov 26, 2026, 2:52 PM' in the FitSync time zone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date);
}

/** Today in the FitSync time zone as 'YYYY-MM-DD' (date inputs, report ranges). */
export function todayISO(): string {
  return dateOfInstant(new Date());
}

/** The FitSync-time-zone date `days` days before today. */
export function daysAgoISO(days: number): string {
  const [y, m, d] = todayISO().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** '2026-11' -> 'Nov 2026' */
export function formatMonth(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
