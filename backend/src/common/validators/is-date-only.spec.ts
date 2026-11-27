import { isDateOnly } from './is-date-only';

describe('isDateOnly', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(isDateOnly('2026-10-23')).toBe(true);
    expect(isDateOnly('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible dates, timestamps and other formats', () => {
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2025-02-29')).toBe(false);
    expect(isDateOnly('2026-10-23T08:00:00Z')).toBe(false);
    expect(isDateOnly('10/23/2026')).toBe(false);
    expect(isDateOnly(20261023)).toBe(false);
  });
});
