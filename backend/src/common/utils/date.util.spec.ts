import '../../config/timezone';
import { localDateOf, localDayEnd, localDayStart } from './date.util';
import { localWallClockToUtc } from '../../database/timestamps';

describe('time zone helpers (APP_TIME_ZONE = Asia/Manila, UTC+8)', () => {
  it('takes the Manila calendar day of a UTC instant', () => {
    expect(localDateOf('2026-11-26T15:59:59Z')).toBe('2026-11-26'); // 23:59:59 in Manila
    expect(localDateOf('2026-11-26T16:00:00Z')).toBe('2026-11-27'); // 00:00 in Manila
  });

  it('builds Manila day boundaries as UTC instants', () => {
    expect(localDayStart('2026-11-26').toISOString()).toBe('2026-11-25T16:00:00.000Z');
    expect(localDayEnd('2026-11-26').toISOString()).toBe('2026-11-26T15:59:59.999Z');
  });

  it('converts a local wall-clock value stored by CURRENT_TIMESTAMP to UTC', () => {
    expect(localWallClockToUtc('2026-11-26 14:52:33')).toBe('2026-11-26 06:52:33');
    expect(localWallClockToUtc('2026-11-27 03:00:00')).toBe('2026-11-26 19:00:00');
  });
});
