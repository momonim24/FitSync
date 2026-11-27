/**
 * CSV writer that is safe to open in Excel / Google Sheets / LibreOffice.
 *
 * CSV formula injection: a cell whose text starts with = + - @ (or a tab /
 * carriage return) may be executed as a formula by spreadsheet software.
 * Any such TEXT value — e.g. an exercise name like "=HYPERLINK(...)" — is
 * prefixed with a single quote so it is displayed as text (OWASP guidance).
 * Real numbers are written as numbers (a negative weight change stays -1.5).
 * Every text cell is quoted and embedded quotes are doubled (RFC 4180).
 */
export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvCell[][]): string {
  // BOM so Excel detects UTF-8; CRLF line endings per RFC 4180.
  return '﻿' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}

/** Builds a CSV from titled sections separated by a blank line. */
export function sectionsToCsv(title: string, meta: Array<[string, CsvCell]>, sections: Array<{ title: string; header: string[]; rows: CsvCell[][] }>): string {
  const rows: CsvCell[][] = [[title], ...meta.map(([k, v]) => [k, v])];
  for (const section of sections) {
    rows.push([], [section.title], section.header, ...(section.rows.length ? section.rows : [['(no data)']]));
  }
  return toCsv(rows);
}
