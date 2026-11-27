/**
 * PDF export (jsPDF + jspdf-autotable). A4 portrait, white pages, charcoal
 * text and lime accents. Charts are drawn as vector shapes from the report
 * numbers (no screenshots), tables repeat their header on every page, and
 * every page gets the same footer with "Page X of Y".
 */
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { dateTime, longDate, monthLabel, shortDay } from './format';
import { cellText, type Chart, type ReportDocument, type Table } from './model';

type RGB = [number, number, number];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [75, 85, 99];
const FAINT: RGB = [120, 128, 140];
const LINE: RGB = [214, 218, 224];
const GRID: RGB = [232, 235, 239];
const CHARCOAL: RGB = [29, 32, 37];
const LIME: RGB = [163, 230, 53];
const LIME_DARK: RGB = [77, 124, 15];
const LIME_TINT: RGB = [246, 251, 234];
const PANEL: RGB = [248, 249, 251];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 16; // top of continuation pages
const BOTTOM = PAGE_H - 20; // content must end above the footer

/**
 * The built-in PDF fonts only cover Windows-1252. Replace the few symbols we
 * use that fall outside it, and anything else unsupported, so no character is
 * rendered as garbage.
 */
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function pdfText(text: string): string {
  return text
    .replace(/→/g, '->')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/−/g, '-')
    .replace(/Δ/g, 'change')
    .replace(/[^\u0000-ÿ]/g, (ch) => (CP1252_EXTRA.includes(ch) ? ch : '?'));
}

class PdfReport {
  readonly doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  private y = MARGIN;

  constructor(private readonly r: ReportDocument) {}

  private color(kind: 'text' | 'fill' | 'draw', c: RGB) {
    if (kind === 'text') this.doc.setTextColor(c[0], c[1], c[2]);
    if (kind === 'fill') this.doc.setFillColor(c[0], c[1], c[2]);
    if (kind === 'draw') this.doc.setDrawColor(c[0], c[1], c[2]);
  }

  private font(size: number, style: 'normal' | 'bold' | 'italic' = 'normal', c: RGB = INK) {
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    this.color('text', c);
  }

  private text(value: string, x: number, y: number, opts?: { align?: 'left' | 'right' | 'center'; maxWidth?: number }) {
    let t = pdfText(value);
    if (opts?.maxWidth) t = this.fit(t, opts.maxWidth);
    this.doc.text(t, x, y, { align: opts?.align ?? 'left', baseline: 'alphabetic' });
  }

  /** Shortens text with an ellipsis so it fits `width` mm at the current font. */
  private fit(text: string, width: number): string {
    if (this.doc.getTextWidth(text) <= width) return text;
    let t = text;
    while (t.length > 1 && this.doc.getTextWidth(`${t}…`) > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  private ensureSpace(height: number) {
    if (this.y + height > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  // --------------------------------------------------------------- header
  private logo(x: number, y: number, size: number) {
    this.color('fill', LIME);
    this.doc.roundedRect(x, y, size, size, size * 0.28, size * 0.28, 'F');
    this.color('draw', CHARCOAL);
    this.doc.setLineWidth(size * 0.08);
    this.doc.setLineJoin('round');
    this.doc.setLineCap('round');
    const p = (px: number, py: number): [number, number] => [x + (px / 32) * size, y + (py / 32) * size];
    const pts = [p(7, 17), p(11, 17), p(13.5, 11), p(18.5, 23), p(21, 17), p(25, 17)];
    for (let i = 1; i < pts.length; i++) this.doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }

  private header() {
    const r = this.r;
    this.logo(MARGIN, 11, 11);
    this.font(17, 'bold');
    this.text('FitSync', MARGIN + 14, 18.2);
    this.font(7.5, 'normal', MUTED);
    this.text('Fitness Activity Monitoring and Management System', MARGIN + 14, 22.6);

    this.font(13, 'bold');
    this.text(r.title, PAGE_W - MARGIN, 17.5, { align: 'right', maxWidth: 95 });
    this.font(8, 'normal', MUTED);
    this.text(`Generated ${dateTime(r.generatedAt)}`, PAGE_W - MARGIN, 22.6, { align: 'right' });

    this.color('fill', LIME);
    this.doc.rect(MARGIN, 26.5, CONTENT_W, 0.9, 'F');
    this.y = 31;

    // Information panel: who / which period / who prepared it.
    const rows: Array<[string, string]> = [...r.subject, ['Reporting period', r.period.text]];
    if (r.preparedBy) rows.push(['Prepared by', r.preparedBy]);
    const half = Math.ceil(rows.length / 2);
    const colW = CONTENT_W / 2;
    const rowH = 5.2;
    const panelH = half * rowH + 5;
    this.color('fill', PANEL);
    this.color('draw', LINE);
    this.doc.setLineWidth(0.2);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, panelH, 2, 2, 'FD');
    rows.forEach(([label, value], i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const x = MARGIN + 4 + col * colW;
      const yy = this.y + 6 + row * rowH;
      this.font(7, 'normal', FAINT);
      this.text(label.toUpperCase(), x, yy);
      this.font(8.8, 'bold');
      this.text(value, x + 30, yy, { maxWidth: colW - 36 });
    });
    this.y += panelH + 6;
  }

  // --------------------------------------------------------------- headings
  private heading(title: string, extraSpace = 0) {
    this.ensureSpace(14 + extraSpace);
    this.font(11, 'bold');
    this.text(title, MARGIN, this.y + 4);
    this.color('fill', LIME);
    this.doc.rect(MARGIN, this.y + 5.8, 12, 0.8, 'F');
    this.y += 9.5;
  }

  // --------------------------------------------------------------- metrics
  private metrics() {
    const cards = this.r.metrics;
    const perRow = 4;
    const gap = 3.5;
    const w = (CONTENT_W - gap * (perRow - 1)) / perRow;
    const h = 20.5;
    const rows = Math.ceil(cards.length / perRow);
    this.heading('Summary', h + 2);
    for (let row = 0; row < rows; row++) {
      this.ensureSpace(h + gap);
      for (let col = 0; col < perRow; col++) {
        const card = cards[row * perRow + col];
        if (!card) continue;
        const x = MARGIN + col * (w + gap);
        const y = this.y;
        this.color('fill', [255, 255, 255]);
        this.color('draw', LINE);
        this.doc.setLineWidth(0.25);
        this.doc.roundedRect(x, y, w, h, 1.8, 1.8, 'FD');
        this.color('fill', LIME);
        this.doc.rect(x, y + 3, 1.1, h - 6, 'F');
        this.font(6.6, 'bold', FAINT);
        this.text((card.card ?? card.label).toUpperCase(), x + 4, y + 5.6, { maxWidth: w - 6 });
        this.font(13.5, 'bold');
        this.text(card.display, x + 4, y + 12.6, { maxWidth: w - 6 });
        if (card.hint) {
          this.font(6.8, 'normal', MUTED);
          this.text(card.hint, x + 4, y + 17.3, { maxWidth: w - 6 });
        }
      }
      this.y += h + gap;
    }
    this.y += 2;
  }

  // --------------------------------------------------------------- charts
  private chartLabel(chart: Chart, label: string): string {
    if (chart.labelType === 'day') return shortDay(label);
    if (chart.labelType === 'month') return monthLabel(label);
    return label;
  }

  /** Rounded-up axis maximum and a whole-number tick step (1, 2, 5 × 10^n). */
  private niceScale(max: number, ticks = 4): { max: number; step: number } {
    if (max <= 0) return { max: 1, step: 1 };
    const raw = max / ticks;
    const mag = 10 ** Math.floor(Math.log10(raw));
    // Whole-number steps only: every plotted value is a count or minutes.
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!);
    return { max: Math.ceil(max / step) * step, step };
  }

  private chartFrame(chart: Chart, height: number): { x: number; y: number; w: number; h: number } | null {
    this.ensureSpace(height + 4);
    const top = this.y;
    this.color('fill', [255, 255, 255]);
    this.color('draw', LINE);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(MARGIN, top, CONTENT_W, height, 2, 2, 'FD');
    this.font(9.5, 'bold');
    this.text(chart.title, MARGIN + 4, top + 6.5);
    this.y += height + 5;
    const hasData = chart.points.length > 0 && chart.points.some((p) => p.value !== 0);
    const minPoints = chart.kind === 'line' ? 2 : 1;
    if (!hasData || chart.points.length < minPoints) {
      this.font(8.5, 'italic', FAINT);
      this.text(chart.emptyText, PAGE_W / 2, top + height / 2 + 3, { align: 'center' });
      return null;
    }
    return { x: MARGIN, y: top, w: CONTENT_W, h: height };
  }

  private yAxis(x0: number, y0: number, w: number, h: number, scale: { max: number; step: number }, min = 0, decimals = 0) {
    this.doc.setLineWidth(0.15);
    for (let v = min; v <= scale.max + 1e-9; v += scale.step) {
      const yy = y0 + h - ((v - min) / (scale.max - min)) * h;
      this.color('draw', GRID);
      this.doc.line(x0, yy, x0 + w, yy);
      this.font(6.5, 'normal', FAINT);
      this.text(v.toFixed(decimals), x0 - 2, yy + 1.1, { align: 'right' });
    }
  }

  private barChart(chart: Chart) {
    const f = this.chartFrame(chart, 62);
    if (!f) return;
    const x0 = f.x + 14;
    const y0 = f.y + 11;
    const w = f.w - 20;
    const h = 38;
    const scale = this.niceScale(Math.max(...chart.points.map((p) => p.value)));
    this.yAxis(x0, y0, w, h, scale);
    const n = chart.points.length;
    const slot = w / n;
    const barW = Math.min(slot * 0.72, 7);
    this.color('fill', LIME);
    chart.points.forEach((p, i) => {
      if (p.value <= 0) return;
      const bh = (p.value / scale.max) * h;
      this.doc.rect(x0 + i * slot + (slot - barW) / 2, y0 + h - bh, barW, bh, 'F');
    });
    // Baseline + up to ~8 evenly spaced x labels.
    this.color('draw', LINE);
    this.doc.setLineWidth(0.3);
    this.doc.line(x0, y0 + h, x0 + w, y0 + h);
    const every = Math.max(1, Math.ceil(n / 8));
    this.font(6.5, 'normal', FAINT);
    for (let i = 0; i < n; i += every) this.text(this.chartLabel(chart, chart.points[i].label), x0 + i * slot + slot / 2, y0 + h + 4.2, { align: 'center' });
    const total = chart.points.reduce((s, p) => s + p.value, 0);
    this.font(7, 'normal', MUTED);
    this.text(`Total: ${total.toLocaleString('en-US')} ${chart.unit}`, f.x + f.w - 4, f.y + 6.5, { align: 'right' });
  }

  private hbarChart(chart: Chart) {
    const rows = chart.points.length;
    const rowH = rows > 6 ? 5.2 : 6.2;
    const height = Math.max(26, 13 + rows * rowH);
    const f = this.chartFrame(chart, height);
    if (!f) return;
    const labelW = 46;
    const x0 = f.x + 4 + labelW;
    const w = f.w - labelW - 22;
    const max = Math.max(...chart.points.map((p) => p.value));
    chart.points.forEach((p, i) => {
      const yy = f.y + 11 + i * rowH;
      this.font(7.5, 'normal', MUTED);
      this.text(p.label, x0 - 3, yy + 3.4, { align: 'right', maxWidth: labelW - 2 });
      const bw = max > 0 ? (p.value / max) * w : 0;
      this.color('fill', GRID);
      this.doc.rect(x0, yy + 0.6, w, 3.8, 'F');
      this.color('fill', LIME);
      if (bw > 0) this.doc.rect(x0, yy + 0.6, bw, 3.8, 'F');
      this.font(7.5, 'bold');
      this.text(`${p.value.toLocaleString('en-US')}`, x0 + w + 2.5, yy + 3.4);
    });
  }

  private lineChart(chart: Chart) {
    const f = this.chartFrame(chart, 62);
    if (!f) return;
    const x0 = f.x + 16;
    const y0 = f.y + 11;
    const w = f.w - 24;
    const h = 38;
    const values = chart.points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const spread = Math.max(hi - lo, 1);
    const step = spread > 12 ? 5 : spread > 5 ? 2 : 1;
    const min = Math.floor((lo - step / 2) / step) * step;
    const max = Math.ceil((hi + step / 2) / step) * step;
    this.yAxis(x0, y0, w, h, { max, step }, min);
    // X positions proportional to the real dates (records can be irregular).
    const times = chart.points.map((p) => Date.parse(`${p.label}T00:00:00Z`));
    const t0 = times[0];
    const span = Math.max(times[times.length - 1] - t0, 1);
    const pts = chart.points.map((p, i) => ({ x: x0 + ((times[i] - t0) / span) * w, y: y0 + h - ((p.value - min) / (max - min)) * h, p }));
    this.color('draw', LIME_DARK);
    this.doc.setLineWidth(0.6);
    for (let i = 1; i < pts.length; i++) this.doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    pts.forEach((pt) => {
      this.color('fill', LIME);
      this.color('draw', LIME_DARK);
      this.doc.setLineWidth(0.3);
      this.doc.circle(pt.x, pt.y, 0.9, 'FD');
    });
    const every = Math.max(1, Math.ceil(pts.length / 7));
    this.font(6.5, 'normal', FAINT);
    pts.forEach((pt, i) => {
      if (i % every === 0 || i === pts.length - 1) this.text(this.chartLabel(chart, pt.p.label), pt.x, y0 + h + 4.2, { align: 'center' });
    });
    this.font(7, 'normal', MUTED);
    this.text(`First ${values[0]} kg · latest ${values[values.length - 1]} kg`, f.x + f.w - 4, f.y + 6.5, { align: 'right' });
  }

  private charts() {
    for (const chart of this.r.charts) {
      if (chart.kind === 'bar') this.barChart(chart);
      else if (chart.kind === 'hbar') this.hbarChart(chart);
      else this.lineChart(chart);
    }
  }

  // --------------------------------------------------------------- tables
  private table(t: Table) {
    const rows = t.pdfRows ?? t.rows;
    this.heading(t.title, rows.length ? 18 : 6);
    if (rows.length === 0) {
      this.font(8.5, 'italic', FAINT);
      this.text(t.emptyText, MARGIN, this.y + 2);
      this.y += 9;
      return;
    }
    const numeric = (type: string) => type !== 'text' && type !== 'date' && type !== 'month';
    autoTable(this.doc, {
      startY: this.y,
      head: [t.columns.map((c) => pdfText(c.header))],
      body: rows.map((row) => t.columns.map((c) => pdfText(cellText(c.type, row[c.key] ?? null)))),
      margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: PAGE_H - BOTTOM + 2 },
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      // Narrow tables (2–3 columns) do not need the full page width.
      tableWidth: t.columns.length <= 3 ? CONTENT_W * 0.62 : 'auto',
      styles: { font: 'helvetica', fontSize: 8.3, cellPadding: { top: 1.8, bottom: 1.8, left: 2.4, right: 2.4 }, textColor: INK, lineColor: LINE, lineWidth: 0.15, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: CHARCOAL, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIME_TINT },
      columnStyles: Object.fromEntries(t.columns.map((c, i) => [i, numeric(c.type) ? { halign: 'right' as const } : {}])),
      didParseCell: (data) => {
        if (data.section === 'head' && numeric(t.columns[data.column.index].type)) data.cell.styles.halign = 'right';
      },
    });
    this.y = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2.5;
    if (t.pdfNote) {
      this.font(7, 'italic', FAINT);
      const lines = this.doc.splitTextToSize(pdfText(t.pdfNote), CONTENT_W);
      this.ensureSpace(lines.length * 3.4);
      this.doc.text(lines, MARGIN, this.y + 2.5);
      this.y += lines.length * 3.4 + 1;
    }
    this.y += 4;
  }

  private definitions() {
    if (!this.r.definitions.length) return;
    this.heading('Definitions', 8);
    this.font(7.8, 'normal', MUTED);
    for (const d of this.r.definitions) {
      const lines = this.doc.splitTextToSize(pdfText(`•  ${d}`), CONTENT_W - 2);
      this.ensureSpace(lines.length * 3.8 + 1);
      this.doc.text(lines, MARGIN + 1, this.y + 2.5);
      this.y += lines.length * 3.8 + 0.8;
    }
  }

  private footers() {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.color('draw', LINE);
      this.doc.setLineWidth(0.25);
      this.doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
      this.font(7, 'normal', FAINT);
      this.text(`FitSync · ${this.r.title}`, MARGIN, PAGE_H - 8.5, { maxWidth: 80 });
      this.text(`${longDate(this.r.period.from)} – ${longDate(this.r.period.to)}`, PAGE_W / 2, PAGE_H - 8.5, { align: 'center' });
      this.font(7, 'bold', MUTED);
      this.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 8.5, { align: 'right' });
    }
  }

  build(): ArrayBuffer {
    // PDF metadata uses a different encoding than page text: keep it plain ASCII.
    this.doc.setProperties({ title: `FitSync ${this.r.title}`.replace(/—/g, '-'), subject: this.r.period.text.replace(/–/g, '-'), author: 'FitSync', creator: 'FitSync', keywords: 'FitSync, fitness report' });
    this.header();
    this.metrics();
    this.charts();
    for (const t of this.r.tables) this.table(t);
    this.definitions();
    this.footers();
    return this.doc.output('arraybuffer');
  }
}

export function buildPdf(report: ReportDocument): ArrayBuffer {
  return new PdfReport(report).build();
}
