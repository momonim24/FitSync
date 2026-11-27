import { escapeCsvCell, toCsv } from './csv';

describe('CSV export security', () => {
  it.each([
    ['=1+1', `"'=1+1"`],
    ['+SUM(A1)', `"'+SUM(A1)"`],
    ['-2+3', `"'-2+3"`],
    ['@cmd', `"'@cmd"`],
    ['\tTAB', `"'\tTAB"`],
    ['\rCR', `"'\rCR"`],
  ])('neutralises a formula-like text cell %j', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it('quotes text and doubles embedded quotes (RFC 4180)', () => {
    expect(escapeCsvCell('Squat, "deep"')).toBe('"Squat, ""deep"""');
  });

  it('keeps real numbers numeric, including negatives', () => {
    expect(escapeCsvCell(-1.5)).toBe('-1.5');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(Number.NaN)).toBe('');
  });

  it('writes empty cells for null/undefined and a UTF-8 BOM with CRLF rows', () => {
    expect(toCsv([['a', null, undefined, 2]])).toBe('﻿"a",,,2\r\n');
  });
});
