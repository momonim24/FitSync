/**
 * Excel export (ExcelJS). One "Summary" sheet plus one sheet per detail
 * table, each with a FitSync title band, report metadata, a styled header
 * row, alternating row fills, frozen header and an AutoFilter.
 *
 * Numbers are stored as numbers and dates as real Excel dates with display
 * formats. Text is always written as a plain string cell (never a formula),
 * so values such as "=HYPERLINK(...)" are displayed, not executed.
 */
import ExcelJS from 'exceljs';
import { dateTime, longDate, utcDate } from './format';
import type { ColumnType, Metric, ReportDocument, Table } from './model';

const CHARCOAL = 'FF1D2025';
const LIME = 'FFA3E635';
const LIME_DARK = 'FF4D7C0F';
const TINT = 'FFF4F9E8';
const LINE = 'FFD6DAE0';
const MUTED = 'FF4B5563';
const WHITE = 'FFFFFFFF';

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (argb = LINE): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb } });

const NUMBER_FORMAT: Record<ColumnType, string | undefined> = {
  text: '@',
  int: '#,##0',
  decimal: '#,##0.0',
  percent: '0.0%',
  kg: '0.0#',
  signedKg: '+0.0#;-0.0#;0.0',
  date: 'dd mmm yyyy',
  month: 'mmm yyyy',
};

const METRIC_FORMAT: Record<NonNullable<Metric['format']>, string> = {
  int: '#,##0',
  decimal: '#,##0.0',
  percent: '0.0%',
  kg: '0.0#',
  signedKg: '+0.0#;-0.0#;0.0',
  text: '@',
};

/** Value stored in the cell: numbers stay numbers, dates become Date objects. */
function cellValue(type: ColumnType, value: string | number | null): ExcelJS.CellValue {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'date') return utcDate(String(value));
  if (type === 'month') return utcDate(`${String(value).slice(0, 7)}-01`);
  if (type === 'text') return String(value);
  return Number(value);
}

/** Display width estimate (characters) for sizing columns. */
function displayLength(type: ColumnType, value: string | number | null): number {
  if (value === null || value === undefined || value === '') return 1;
  if (type === 'date') return 11; // "26 Nov 2026"
  if (type === 'month') return 8;
  if (type === 'percent') return 7;
  if (type === 'text') return String(value).length;
  return Math.round(Number(value)).toLocaleString('en-US').length + 3;
}

class XlsxReport {
  readonly wb = new ExcelJS.Workbook();

  constructor(private readonly r: ReportDocument) {
    this.wb.creator = 'FitSync';
    this.wb.lastModifiedBy = 'FitSync';
    this.wb.created = new Date(r.generatedAt);
    this.wb.title = `FitSync ${r.title}`;
    this.wb.subject = r.period.text;
  }

  /** Title band (rows 1–3) shared by every sheet. */
  private banner(ws: ExcelJS.Worksheet, columns: number) {
    const span = Math.max(columns, 6);
    const meta = [...this.r.subject.map(([k, v]) => `${k}: ${v}`), `Period: ${this.r.period.text}`, `Generated: ${dateTime(this.r.generatedAt)}`];
    if (this.r.preparedBy) meta.push(`Prepared by: ${this.r.preparedBy}`);

    const title = ws.getRow(1);
    title.height = 28;
    const tagline = ws.getRow(2);
    for (let c = 1; c <= span; c++) {
      title.getCell(c).fill = fill(CHARCOAL);
      tagline.getCell(c).fill = fill(CHARCOAL);
      tagline.getCell(c).border = { bottom: { style: 'medium', color: { argb: LIME } } };
    }
    title.getCell(1).value = `FitSync — ${this.r.title}`;
    title.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
    title.getCell(1).alignment = { vertical: 'middle' };
    tagline.getCell(1).value = 'Fitness Activity Monitoring and Management System';
    tagline.getCell(1).font = { name: 'Calibri', size: 9, color: { argb: LIME } };

    const metaRow = ws.getRow(3);
    metaRow.getCell(1).value = meta.join('   ·   ');
    metaRow.getCell(1).font = { name: 'Calibri', size: 9, color: { argb: MUTED } };
    metaRow.height = 18;
  }

  private sectionTitle(ws: ExcelJS.Worksheet, rowNumber: number, text: string) {
    const cell = ws.getRow(rowNumber).getCell(1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF111827' } };
  }

  private headerRow(ws: ExcelJS.Worksheet, rowNumber: number, headers: string[], numeric: boolean[]) {
    const row = ws.getRow(rowNumber);
    row.height = 20;
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: WHITE } };
      cell.fill = fill(CHARCOAL);
      cell.alignment = { vertical: 'middle', horizontal: numeric[i] ? 'right' : 'left' };
      cell.border = { bottom: { style: 'medium', color: { argb: LIME } }, top: thin(CHARCOAL), left: thin(CHARCOAL), right: thin(CHARCOAL) };
    });
  }

  private styleDataCell(cell: ExcelJS.Cell, index: number, numFmt?: string, wrap = false) {
    if (index % 2 === 1) cell.fill = fill(TINT);
    cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
    cell.font = { name: 'Calibri', size: 10.5 };
    if (numFmt) cell.numFmt = numFmt;
    cell.alignment = { vertical: 'top', wrapText: wrap };
  }

  // -------------------------------------------------------------- Summary
  private summarySheet() {
    const ws = this.wb.addWorksheet('Summary', { properties: { tabColor: { argb: LIME } } });
    ws.columns = [{ width: 36 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }];
    this.banner(ws, 3);

    let row = 5;
    this.sectionTitle(ws, row, 'Report information');
    row += 1;
    const info: Array<[string, string]> = [...this.r.subject, ['Reporting period', this.r.period.text], ['From', longDate(this.r.period.from)], ['To', longDate(this.r.period.to)], ['Days in period', String(this.r.period.days)], ['Generated', dateTime(this.r.generatedAt)]];
    if (this.r.preparedBy) info.push(['Prepared by', this.r.preparedBy]);
    for (const [label, value] of info) {
      const r = ws.getRow(row++);
      r.getCell(1).value = label;
      r.getCell(1).font = { name: 'Calibri', size: 10.5, color: { argb: MUTED } };
      r.getCell(2).value = label === 'Days in period' ? Number(value) : value;
      r.getCell(2).font = { name: 'Calibri', size: 10.5, bold: true };
      r.getCell(2).alignment = { horizontal: 'left' };
    }

    row += 1;
    this.sectionTitle(ws, row, 'Key metrics');
    row += 1;
    const headerRowNumber = row;
    this.headerRow(ws, row, ['Metric', 'Value', 'Unit'], [false, true, false]);
    row += 1;
    this.r.metrics.forEach((m, i) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = m.label;
      const valueCell = r.getCell(2);
      if (m.value === null) {
        valueCell.value = 'n/a';
        valueCell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: MUTED } };
      } else {
        valueCell.value = typeof m.value === 'number' ? m.value : String(m.value);
      }
      r.getCell(3).value = m.unit;
      [1, 2, 3].forEach((c) => this.styleDataCell(r.getCell(c), i, c === 2 && m.value !== null ? METRIC_FORMAT[m.format ?? 'int'] : c === 2 ? undefined : '@'));
      valueCell.alignment = { horizontal: 'right' };
      if (m.value === null) valueCell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: MUTED } };
    });
    ws.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];

    row += 1;
    if (this.r.definitions.length) {
      this.sectionTitle(ws, row++, 'Definitions');
      for (const d of this.r.definitions) {
        const cell = ws.getRow(row++).getCell(1);
        cell.value = d;
        cell.font = { name: 'Calibri', size: 9.5, color: { argb: MUTED } };
      }
    }
    row += 1;
    const sheets = ws.getRow(row).getCell(1);
    sheets.value = `Detail sheets: ${this.r.tables.map((t) => t.sheetName).join(', ')}`;
    sheets.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: LIME_DARK } };
  }

  // -------------------------------------------------------------- table sheets
  private tableSheet(t: Table) {
    const ws = this.wb.addWorksheet(t.sheetName.slice(0, 31));
    const numeric = t.columns.map((c) => c.type !== 'text');
    this.banner(ws, t.columns.length);
    this.sectionTitle(ws, 5, t.title);
    const headerRowNumber = 6;
    this.headerRow(ws, headerRowNumber, t.columns.map((c) => c.header), numeric);

    // Column widths from the longest displayed value (dates fixed so they never show ####).
    t.columns.forEach((c, i) => {
      const longest = Math.max(c.header.length + 3, ...t.rows.map((r) => displayLength(c.type, r[c.key] ?? null) + 2));
      const min = c.type === 'date' ? 15 : c.type === 'month' ? 12 : 10;
      ws.getColumn(i + 1).width = Math.min(Math.max(longest, min), 60);
    });

    if (t.rows.length === 0) {
      const cell = ws.getRow(headerRowNumber + 1).getCell(1);
      cell.value = t.emptyText;
      cell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: MUTED } };
    } else {
      t.rows.forEach((source, i) => {
        const row = ws.getRow(headerRowNumber + 1 + i);
        t.columns.forEach((c, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = cellValue(c.type, source[c.key] ?? null);
          const wrap = c.type === 'text' && String(source[c.key] ?? '').length > 60;
          this.styleDataCell(cell, i, NUMBER_FORMAT[c.type], wrap);
          if (numeric[ci]) cell.alignment = { ...cell.alignment, horizontal: 'right' };
        });
      });
      ws.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: headerRowNumber + t.rows.length, column: t.columns.length },
      };
    }
    ws.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];
  }

  async build(): Promise<ArrayBuffer> {
    this.summarySheet();
    for (const t of this.r.tables) this.tableSheet(t);
    const buffer = await this.wb.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }
}

export function buildXlsx(report: ReportDocument): Promise<ArrayBuffer> {
  return new XlsxReport(report).build();
}
