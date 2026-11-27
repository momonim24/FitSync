/** Formats a Date as 'YYYY-MM-DD' using the server's local calendar day. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the 'YYYY-MM-DD' string for today shifted by `offsetDays`. */
export function daysFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toDateString(date);
}

/** Lists consecutive 'YYYY-MM-DD' strings ending today (oldest first). */
export function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => daysFromToday(i - (n - 1)));
}

/*
 * Instants vs calendar days. DATETIME instants are stored in UTC; calendar
 * days belong to the application time zone (config/timezone.ts pins Node's
 * local zone to APP_TIME_ZONE, Asia/Manila by default).
 */

/** The app-time-zone calendar day of an instant, as 'YYYY-MM-DD'. */
export function localDateOf(instant: Date | string): string {
  return toDateString(new Date(instant));
}

/** First instant of a 'YYYY-MM-DD' day in the app time zone. */
export function localDayStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Last instant of a 'YYYY-MM-DD' day in the app time zone. */
export function localDayEnd(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
