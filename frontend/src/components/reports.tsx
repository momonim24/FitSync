import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { getErrorMessage } from '../api/client';
import { reportsApi, type ReportParams } from '../api/services';
import type { AdminReport, MemberReport, TrainerReport } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type AnyReport = MemberReport | TrainerReport | AdminReport;
import { daysAgoISO, formatDate, formatMinutes, todayISO } from '../lib/format';
import { daysBetween, requiredDate } from '../lib/validation';
import { ActivityChart, RankedBars, WeightChart } from './charts';
import { MemberFitnessReportSection } from './fitness-reports';
import { Button, Card, EmptyState, StatCard, Table, Td, Th } from './ui';
import { Activity, CalendarCheck, Dumbbell, Flame, Repeat, Scale, Timer, TrendingUp } from 'lucide-react';

/** Date-range filter: Last 7 days / Last 30 days / Custom (validated before sending). */
export function ReportFilters({ value, onChange }: { value: ReportParams; onChange: (p: ReportParams) => void }) {
  const [from, setFrom] = useState(value.from ?? daysAgoISO(29));
  const [to, setTo] = useState(value.to ?? todayISO());
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});

  /** Mirrors resolveRange() in the API: both dates, from <= to, not in the future, at most 366 days. */
  const applyCustom = (event: FormEvent) => {
    event.preventDefault();
    const found = {
      from: requiredDate(from, 'Start date'),
      to: requiredDate(to, 'End date') ?? (to > todayISO() ? 'The end date cannot be in the future.' : undefined),
    };
    if (!found.from && !found.to) {
      if (from > to) found.from = 'The start date must be on or before the end date.';
      else if (daysBetween(from, to) + 1 > 366) found.from = 'A report can cover at most 366 days.';
    }
    setErrors(found);
    if (found.from || found.to) return;
    onChange({ period: 'custom', from, to });
  };

  const preset = (period: 'week' | 'month', label: string) => (
    <button
      type="button"
      onClick={() => (setErrors({}), onChange({ period }))}
      aria-pressed={value.period === period}
      className={`h-10 rounded-xl px-4 text-sm font-medium transition-colors ${
        value.period === period ? 'bg-lime text-on-lime' : 'border border-line bg-raised text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="card mb-6 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Report period">
          {preset('week', 'Last 7 days')}
          {preset('month', 'Last 30 days')}
        </div>
        <form onSubmit={applyCustom} className="flex flex-1 flex-wrap items-end gap-2 lg:justify-end" noValidate>
          <label>
            <span className="label">From</span>
            <input type="date" className="field" value={from} max={todayISO()} aria-invalid={Boolean(errors.from)} aria-describedby={errors.from ? 'report-from-msg' : undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="field" value={to} max={todayISO()} aria-invalid={Boolean(errors.to)} aria-describedby={errors.to ? 'report-to-msg' : undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button type="submit" variant={value.period === 'custom' ? 'primary' : 'secondary'}>
            Apply custom range
          </Button>
        </form>
      </div>
      {(errors.from || errors.to) && (
        <div role="alert" className="mt-2 space-y-0.5 text-sm text-danger lg:text-right">
          {errors.from && <p id="report-from-msg">From: {errors.from}</p>}
          {errors.to && <p id="report-to-msg">To: {errors.to}</p>}
        </div>
      )}
    </div>
  );
}

type ExportKind = 'pdf' | 'xlsx' | 'csv';

/**
 * Report export actions:
 *  - Download PDF / Export Excel: generated in the browser from the report
 *    already on screen (same data, date range and permissions). The export
 *    code (jsPDF, ExcelJS) is loaded only when clicked.
 *  - Export CSV: raw data downloaded from the API (?format=csv).
 */
export function ReportActions({
  csvPath,
  params,
  report,
  memberViewedByTrainer = false,
}: {
  csvPath: string;
  params: ReportParams;
  report: AnyReport | null;
  memberViewedByTrainer?: boolean;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const disabled = !report || busy !== null;
  // Ref guard: a fast double-click cannot start two exports before the buttons re-render disabled.
  const inFlight = useRef(false);

  const run = async (kind: ExportKind) => {
    if (!report || inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    try {
      if (kind === 'csv') {
        await reportsApi.downloadCsv(csvPath, params);
        toast.success('CSV file downloaded.');
      } else {
        const { buildReportFile, saveFile } = await import('../exports');
        const preparedBy = user ? `${user.fullName} (${user.role})` : undefined;
        const file = await buildReportFile(report, kind, { preparedBy }, memberViewedByTrainer);
        saveFile(file.data, file.filename, file.mime);
        toast.success(kind === 'pdf' ? 'PDF report downloaded.' : 'Excel workbook downloaded.');
      }
    } catch (err) {
      const fallback =
        kind === 'csv'
          ? 'Could not export the CSV file. Check your connection and try again.'
          : `Could not create the ${kind === 'pdf' ? 'PDF' : 'Excel'} file. Please try again; if it keeps failing, use Export CSV instead.`;
      toast.error(kind === 'csv' ? getErrorMessage(err, fallback) : fallback);
      if (kind !== 'csv') console.error(err);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end" role="group" aria-label="Export report">
      <Button icon={FileDown} loading={busy === 'pdf'} disabled={disabled} className="w-full sm:w-auto" onClick={() => run('pdf')} title="Download a formatted A4 PDF report">
        {busy === 'pdf' ? 'Creating PDF…' : 'Download PDF'}
      </Button>
      <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'xlsx'} disabled={disabled} className="w-full sm:w-auto" onClick={() => run('xlsx')} title="Download a formatted Excel workbook (.xlsx)">
        {busy === 'xlsx' ? 'Creating workbook…' : 'Export Excel'}
      </Button>
      <Button variant="secondary" icon={FileText} loading={busy === 'csv'} disabled={disabled} className="w-full sm:w-auto" onClick={() => run('csv')} title="Download the raw data as CSV">
        Export CSV
      </Button>
    </div>
  );
}


export function RangeCaption({ range }: { range: { from: string; to: string; days: number } }) {
  return (
    <p className="mb-4 text-sm text-muted">
      Showing {formatDate(range.from)} – {formatDate(range.to)} ({range.days} days)
    </p>
  );
}

export function SectionGrid({ children }: { children: ReactNode }) {
  // min-w-0 lets a wide table scroll inside its card instead of widening the page (QA fix C1).
  return <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">{children}</div>;
}

const signed = (n: number | null, unit: string) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} ${unit}`);

/** Full member report (used by the member page and by trainers for one member). */
export function MemberReportView({ report }: { report: MemberReport }) {
  const s = report.summary;
  const w = report.weight;
  const empty = s.totalWorkouts === 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workouts" value={s.totalWorkouts} hint={`${s.averageWorkoutsPerWeek} per week on average`} icon={Activity} accent />
        <StatCard label="Training time" value={formatMinutes(s.totalDurationMinutes)} hint={`${s.averageMinutesPerWorkoutDay} min per workout day`} icon={Timer} />
        <StatCard label="Workout days" value={`${s.distinctWorkoutDays} / ${report.range.days}`} hint={`${s.consistencyPercent}% consistency`} icon={CalendarCheck} />
        <StatCard label="Longest streak" value={`${s.longestStreakDays} day${s.longestStreakDays === 1 ? '' : 's'}`} hint="Consecutive days with a workout" icon={Flame} />
        <StatCard label="Sets" value={s.totalSets} icon={Dumbbell} />
        <StatCard label="Repetitions" value={s.totalRepetitions} hint="Sets × reps per set" icon={Repeat} />
        <StatCard label="Weight change" value={signed(w.changeKg, 'kg')} hint={w.measurements ? `${w.startWeightKg ?? '—'} → ${w.endWeightKg ?? '—'} kg` : 'No weight recorded'} icon={Scale} />
        <StatCard label="Exercises used" value={report.exerciseFrequency.length} hint={`${report.categoryBreakdown.length} categories`} icon={TrendingUp} />
      </div>

      <Card title="Minutes trained per day">
        <ActivityChart data={report.daily} />
      </Card>

      <SectionGrid>
        <Card title="Exercise frequency">
          {empty ? <EmptyState title="No workouts in this period" /> : <RankedBars data={report.exerciseFrequency.slice(0, 8)} labelKey="exerciseName" valueKey="workouts" unit="workouts" />}
        </Card>
        <Card title="Weight progress">
          {w.trend.length >= 2 ? (
            <WeightChart data={w.trend} />
          ) : (
            <EmptyState title={w.measurements === 1 ? 'Only one weight record' : 'No weight records'} description="At least two weight records in this period are needed for a trend." icon={Scale} />
          )}
        </Card>
      </SectionGrid>

      <SectionGrid>
        <Card title="Exercise details" padded={false}>
          {empty ? (
            <EmptyState title="No workouts in this period" />
          ) : (
            <Table compact
              head={
                <>
                  <Th>Exercise</Th>
                  <Th className="text-right">Workouts</Th>
                  <Th className="text-right">Sets</Th>
                  <Th className="text-right">Reps</Th>
                  <Th className="text-right">Minutes</Th>
                </>
              }
            >
              {report.exerciseFrequency.map((e) => (
                <tr key={e.exerciseId}>
                  <Td>
                    <span className="font-medium text-ink">{e.exerciseName}</span> <span className="text-xs text-faint">· {e.category}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{e.workouts}</Td>
                  <Td className="text-right tabular-nums">{e.sets}</Td>
                  <Td className="text-right tabular-nums">{e.repetitions}</Td>
                  <Td className="text-right tabular-nums">{e.minutes}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Category breakdown" padded={false}>
          {empty ? (
            <EmptyState title="No workouts in this period" />
          ) : (
            <Table compact
              head={
                <>
                  <Th>Category</Th>
                  <Th className="text-right">Workouts</Th>
                  <Th className="text-right">Share</Th>
                  <Th className="text-right">Minutes</Th>
                </>
              }
            >
              {report.categoryBreakdown.map((c) => (
                <tr key={c.category}>
                  <Td className="font-medium text-ink">{c.category}</Td>
                  <Td className="text-right tabular-nums">{c.workouts}</Td>
                  <Td className="text-right tabular-nums">{c.percent}%</Td>
                  <Td className="text-right tabular-nums">{c.minutes}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </SectionGrid>

      {report.notes.length > 0 && (
        <Card title="Progress notes" padded={false}>
          <ul className="divide-y divide-line">
            {report.notes.map((n, i) => (
              <li key={`${n.date}-${i}`} className="flex gap-4 px-5 py-3 text-sm">
                <span className="w-28 shrink-0 text-faint">{formatDate(n.date)}</span>
                <span className="text-muted">{n.notes}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {report.fitness && <MemberFitnessReportSection fitness={report.fitness} />}

      <p className="text-xs text-faint">
        Definitions: consistency = workout days ÷ days in period; repetitions = sets × repetitions per set; weight change = last − first weight recorded in the period.
      </p>
    </div>
  );
}
