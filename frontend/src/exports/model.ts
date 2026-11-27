/**
 * Report document model — the single source for the PDF and Excel exports.
 * Builders turn the report JSON returned by the FitSync API (already
 * permission-checked by the backend) into titled metrics, charts and tables.
 * No calculation happens here: every value is copied from the report.
 */
import type { AdminReport, MemberReport, TrainerReport } from '../api/types';
import { longDate, minutesText, monthLabel, signedKg, slug } from './format';
import { dateOfInstant } from '../lib/format';

export type ColumnType = 'text' | 'int' | 'decimal' | 'percent' | 'kg' | 'signedKg' | 'date' | 'month';

export interface Column {
  header: string;
  key: string;
  type: ColumnType;
}

export interface Table {
  title: string;
  sheetName: string; // Excel worksheet (max 31 chars)
  columns: Column[];
  rows: Record<string, string | number | null>[];
  /** Optional shorter row set for the PDF (e.g. only days with workouts). */
  pdfRows?: Record<string, string | number | null>[];
  pdfNote?: string;
  emptyText: string;
}

export interface Metric {
  label: string;
  value: number | string | null; // raw value for Excel
  unit: string; // unit shown in Excel
  display: string; // formatted text for the PDF card
  card?: string; // shorter label for the PDF card (full label is used in Excel)
  hint?: string;
  format?: 'int' | 'decimal' | 'percent' | 'signedKg' | 'kg' | 'text';
}

export interface Chart {
  kind: 'bar' | 'hbar' | 'line';
  title: string;
  unit: string;
  points: { label: string; value: number }[];
  labelType: 'day' | 'month' | 'text';
  emptyText: string;
}

export interface ReportDocument {
  reportKind: 'member' | 'trainer' | 'trainer-member' | 'admin';
  title: string;
  subject: Array<[string, string]>; // account / member information
  period: { from: string; to: string; days: number; text: string };
  generatedAt: string;
  preparedBy: string | null;
  metrics: Metric[];
  charts: Chart[];
  tables: Table[];
  definitions: string[];
  fileBase: string;
}

export interface ExportContext {
  /** Name and role of the signed-in user who generates the file. */
  preparedBy?: string;
}

const periodText = (r: { from: string; to: string; days: number }) => `${longDate(r.from)} – ${longDate(r.to)} (${r.days} days)`;

const MEMBER_DEFINITIONS = [
  'Workouts: number of workout logs in the period.',
  'Repetitions: sets × repetitions per set, summed over all workouts.',
  'Consistency: days with at least one workout ÷ days in the period.',
  'Weight change: last weight − first weight recorded in the period (needs at least two weight records).',
];

// ===================================================================== member
export function memberDocument(report: MemberReport, ctx: ExportContext = {}, forTrainer = false): ReportDocument {
  const s = report.summary;
  const w = report.weight;
  const daily = report.daily.map((d) => ({ date: d.date, workouts: d.workouts, minutes: d.minutes }));
  return {
    reportKind: forTrainer ? 'trainer-member' : 'member',
    title: forTrainer ? 'Member Progress Report' : 'Member Fitness Report',
    subject: [
      ['Member', report.member.fullName],
      ['Email', report.member.email],
    ],
    period: { ...report.range, text: periodText(report.range) },
    generatedAt: report.generatedAt,
    preparedBy: ctx.preparedBy ?? null,
    metrics: [
      { label: 'Workouts', value: s.totalWorkouts, unit: 'workouts', display: String(s.totalWorkouts), hint: `${s.averageWorkoutsPerWeek} per week on average`, format: 'int' },
      { label: 'Training time', value: s.totalDurationMinutes, unit: 'minutes', display: minutesText(s.totalDurationMinutes), hint: `${s.averageMinutesPerWorkoutDay} min per workout day`, format: 'int' },
      { label: 'Workout days', value: s.distinctWorkoutDays, unit: 'days', display: `${s.distinctWorkoutDays} / ${report.range.days}`, hint: `${s.consistencyPercent}% consistency`, format: 'int' },
      { label: 'Consistency', value: s.consistencyPercent / 100, unit: '% of days', display: `${s.consistencyPercent}%`, hint: 'Workout days ÷ days in period', format: 'percent' },
      { label: 'Longest streak', value: s.longestStreakDays, unit: 'days', display: `${s.longestStreakDays} day${s.longestStreakDays === 1 ? '' : 's'}`, hint: 'Consecutive workout days', format: 'int' },
      { label: 'Sets', value: s.totalSets, unit: 'sets', display: String(s.totalSets), format: 'int' },
      { label: 'Repetitions', value: s.totalRepetitions, unit: 'reps', display: String(s.totalRepetitions), hint: 'Sets × reps per set', format: 'int' },
      { label: 'Average workouts per week', card: 'Avg. per week', value: s.averageWorkoutsPerWeek, unit: 'workouts/week', display: String(s.averageWorkoutsPerWeek), format: 'decimal' },
      { label: 'Average minutes per workout day', card: 'Avg. min / workout day', value: s.averageMinutesPerWorkoutDay, unit: 'minutes', display: `${s.averageMinutesPerWorkoutDay} min`, format: 'decimal' },
      { label: 'Starting weight', value: w.startWeightKg, unit: 'kg', display: w.startWeightKg === null ? '—' : `${w.startWeightKg} kg`, format: 'kg' },
      { label: 'Latest weight', value: w.endWeightKg, unit: 'kg', display: w.endWeightKg === null ? '—' : `${w.endWeightKg} kg`, format: 'kg' },
      {
        label: 'Weight change',
        value: w.changeKg,
        unit: 'kg',
        display: signedKg(w.changeKg),
        hint: w.measurements ? `${w.measurements} weight record${w.measurements === 1 ? '' : 's'}` : 'No weight recorded',
        format: 'signedKg',
      },
    ],
    charts: [
      { kind: 'bar', title: 'Minutes trained per day', unit: 'min', points: daily.map((d) => ({ label: d.date, value: d.minutes })), labelType: 'day', emptyText: 'No workouts in this period.' },
      {
        kind: 'hbar',
        title: 'Most frequent exercises',
        unit: 'workouts',
        points: report.exerciseFrequency.slice(0, 8).map((e) => ({ label: e.exerciseName, value: e.workouts })),
        labelType: 'text',
        emptyText: 'No workouts in this period.',
      },
      {
        kind: 'line',
        title: 'Weight progress (kg)',
        unit: 'kg',
        points: w.trend.map((t) => ({ label: t.date, value: t.weightKg })),
        labelType: 'day',
        emptyText: w.measurements === 1 ? 'Only one weight record in this period — a trend needs at least two.' : 'No weight records in this period.',
      },
    ],
    tables: [
      {
        title: 'Workout activity',
        sheetName: 'Workout Activity',
        columns: [
          { header: 'Date', key: 'date', type: 'date' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
        ],
        rows: daily,
        pdfRows: daily.filter((d) => d.workouts > 0),
        pdfNote: 'Days with at least one workout. The Excel export lists every day of the period.',
        emptyText: 'No workouts in this period.',
      },
      {
        title: 'Exercise frequency',
        sheetName: 'Exercise Frequency',
        columns: [
          { header: 'Exercise', key: 'exerciseName', type: 'text' },
          { header: 'Category', key: 'category', type: 'text' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Sets', key: 'sets', type: 'int' },
          { header: 'Repetitions', key: 'repetitions', type: 'int' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
        ],
        rows: report.exerciseFrequency.map((e) => ({ ...e })),
        emptyText: 'No workouts in this period.',
      },
      {
        title: 'Category breakdown',
        sheetName: 'Categories',
        columns: [
          { header: 'Category', key: 'category', type: 'text' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Share of workouts', key: 'share', type: 'percent' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
        ],
        rows: report.categoryBreakdown.map((c) => ({ category: c.category, workouts: c.workouts, share: c.percent / 100, minutes: c.minutes })),
        emptyText: 'No workouts in this period.',
      },
      {
        title: 'Weight progress',
        sheetName: 'Weight Progress',
        columns: [
          { header: 'Date', key: 'date', type: 'date' },
          { header: 'Weight (kg)', key: 'weightKg', type: 'kg' },
        ],
        rows: w.trend.map((t) => ({ date: t.date, weightKg: t.weightKg })),
        emptyText: 'No weight records in this period.',
      },
      {
        title: 'Progress notes',
        sheetName: 'Progress Notes',
        columns: [
          { header: 'Date', key: 'date', type: 'date' },
          { header: 'Notes', key: 'notes', type: 'text' },
        ],
        rows: report.notes.map((n) => ({ date: n.date, notes: n.notes })),
        emptyText: 'No progress notes in this period.',
      },
    ],
    definitions: MEMBER_DEFINITIONS,
    fileBase: `fitsync-${forTrainer ? `member-${slug(report.member.fullName)}` : 'member'}-report-${report.range.from}_${report.range.to}`,
  };
}

// ==================================================================== trainer
export function trainerDocument(report: TrainerReport, ctx: ExportContext = {}): ReportDocument {
  const s = report.summary;
  const members = report.members;
  return {
    reportKind: 'trainer',
    title: 'Trainer Report — Assigned Members',
    subject: [
      ['Trainer', report.trainer.fullName],
      ['Email', report.trainer.email],
      ['Assigned members', String(s.assignedMembers)],
    ],
    period: { ...report.range, text: periodText(report.range) },
    generatedAt: report.generatedAt,
    preparedBy: ctx.preparedBy ?? null,
    metrics: [
      { label: 'Assigned members', value: s.assignedMembers, unit: 'members', display: String(s.assignedMembers), format: 'int' },
      { label: 'Active members', value: s.activeMembers, unit: 'members', display: `${s.activeMembers} / ${s.assignedMembers}`, hint: 'At least one workout', format: 'int' },
      { label: 'Member workouts', value: s.totalWorkouts, unit: 'workouts', display: String(s.totalWorkouts), hint: `${s.averageWorkoutsPerMember} per member`, format: 'int' },
      { label: 'Training time', value: s.totalDurationMinutes, unit: 'minutes', display: minutesText(s.totalDurationMinutes), format: 'int' },
      { label: 'Average workouts per member', card: 'Avg. per member', value: s.averageWorkoutsPerMember, unit: 'workouts', display: String(s.averageWorkoutsPerMember), format: 'decimal' },
      { label: 'Average consistency', value: s.averageConsistencyPercent / 100, unit: '% of days', display: `${s.averageConsistencyPercent}%`, format: 'percent' },
      { label: 'Plans created in period', value: s.plansCreatedInRange, unit: 'plans', display: String(s.plansCreatedInRange), format: 'int' },
    ],
    charts: [
      { kind: 'bar', title: 'Member workouts per day', unit: 'workouts', points: report.daily.map((d) => ({ label: d.date, value: d.workouts })), labelType: 'day', emptyText: 'No member workouts in this period.' },
      {
        kind: 'hbar',
        title: 'Workouts per member',
        unit: 'workouts',
        points: members.map((m) => ({ label: m.member.fullName, value: m.totalWorkouts })),
        labelType: 'text',
        emptyText: 'No assigned members.',
      },
    ],
    tables: [
      {
        title: 'Assigned members',
        sheetName: 'Assigned Members',
        columns: [
          { header: 'Member', key: 'name', type: 'text' },
          { header: 'Email', key: 'email', type: 'text' },
          { header: 'Assigned on', key: 'assignedAt', type: 'date' },
          { header: 'Last workout', key: 'lastWorkout', type: 'date' },
          { header: 'Plans', key: 'plans', type: 'int' },
        ],
        rows: members.map((m) => ({ name: m.member.fullName, email: m.member.email, assignedAt: dateOfInstant(m.assignedAt), lastWorkout: m.lastWorkoutDate, plans: m.planCount })),
        emptyText: 'No members are assigned to this trainer.',
      },
      {
        title: 'Member activity',
        sheetName: 'Member Activity',
        columns: [
          { header: 'Member', key: 'name', type: 'text' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
          { header: 'Sets', key: 'sets', type: 'int' },
          { header: 'Repetitions', key: 'reps', type: 'int' },
          { header: 'Workout days', key: 'days', type: 'int' },
          { header: 'Consistency', key: 'consistency', type: 'percent' },
        ],
        rows: members.map((m) => ({
          name: m.member.fullName,
          workouts: m.totalWorkouts,
          minutes: m.totalDurationMinutes,
          sets: m.totalSets,
          reps: m.totalRepetitions,
          days: m.distinctWorkoutDays,
          consistency: m.consistencyPercent / 100,
        })),
        emptyText: 'No assigned members.',
      },
      {
        title: 'Member progress',
        sheetName: 'Member Progress',
        columns: [
          { header: 'Member', key: 'name', type: 'text' },
          { header: 'Latest weight (kg)', key: 'latest', type: 'kg' },
          { header: 'Weight change (kg)', key: 'change', type: 'signedKg' },
        ],
        rows: members.map((m) => ({ name: m.member.fullName, latest: m.latestWeightKg, change: m.weightChangeKg })),
        pdfNote: 'Weight change needs at least two weight records in the period.',
        emptyText: 'No assigned members.',
      },
      {
        title: 'Daily activity (all assigned members)',
        sheetName: 'Daily Activity',
        columns: [
          { header: 'Date', key: 'date', type: 'date' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
        ],
        rows: report.daily.map((d) => ({ ...d })),
        pdfRows: report.daily.filter((d) => d.workouts > 0).map((d) => ({ ...d })),
        pdfNote: 'Days with at least one workout. The Excel export lists every day of the period.',
        emptyText: 'No member workouts in this period.',
      },
    ],
    definitions: [
      'Active member: at least one workout log in the period.',
      'Consistency: days with a workout ÷ days in the period; the average is taken over assigned members.',
      'Weight change: last − first weight recorded in the period (needs at least two weight records).',
    ],
    fileBase: `fitsync-trainer-report-${report.range.from}_${report.range.to}`,
  };
}

// ====================================================================== admin
export function adminDocument(report: AdminReport, ctx: ExportContext = {}): ReportDocument {
  const monthly = report.seriesGranularity === 'month';
  const periodType = monthly ? 'month' : 'date';
  const u = report.usage;
  return {
    reportKind: 'admin',
    title: 'System Report',
    subject: [['Scope', 'All FitSync users']],
    period: { ...report.range, text: periodText(report.range) },
    generatedAt: report.generatedAt,
    preparedBy: ctx.preparedBy ?? null,
    metrics: [
      { label: 'Users', value: report.users.total, unit: 'users', display: String(report.users.total), hint: `${report.users.active} active · ${report.users.inactive} deactivated`, format: 'int' },
      { label: 'Active users', value: report.users.active, unit: 'users', display: String(report.users.active), format: 'int' },
      { label: 'New registrations', value: report.registrations.inRange, unit: 'users', display: String(report.registrations.inRange), hint: 'In this period', format: 'int' },
      { label: 'Workouts logged', value: report.activity.totalWorkouts, unit: 'workouts', display: String(report.activity.totalWorkouts), hint: minutesText(report.activity.totalDurationMinutes), format: 'int' },
      { label: 'Training time', value: report.activity.totalDurationMinutes, unit: 'minutes', display: minutesText(report.activity.totalDurationMinutes), format: 'int' },
      { label: 'Active members', value: report.activity.activeMembers, unit: 'members', display: String(report.activity.activeMembers), hint: `${report.activity.averageWorkoutsPerActiveMember} workouts each`, format: 'int' },
      { label: 'Trainer assignments', value: report.assignments.total, unit: 'assignments', display: String(report.assignments.total), hint: `${report.assignments.averageMembersPerTrainer} members per trainer`, format: 'int' },
      { label: 'Members without a trainer', value: report.assignments.unassignedActiveMembers, unit: 'members', display: String(report.assignments.unassignedActiveMembers), format: 'int' },
      { label: 'Progress records', value: u.progressRecords, unit: 'records', display: String(u.progressRecords), format: 'int' },
      { label: 'Workout plans created', value: u.workoutPlansCreated, unit: 'plans', display: String(u.workoutPlansCreated), format: 'int' },
      { label: 'Exercises imported from wger', card: 'Imported from wger', value: u.exercisesImported, unit: 'exercises', display: String(u.exercisesImported), format: 'int' },
      { label: 'Members with activity', value: u.activeUsers, unit: 'members', display: String(u.activeUsers), hint: 'Workout or progress record', format: 'int' },
    ],
    charts: [
      {
        kind: 'bar',
        title: `Workouts per ${monthly ? 'month' : 'day'}`,
        unit: 'workouts',
        points: report.activity.series.map((p) => ({ label: p.period, value: p.workouts })),
        labelType: monthly ? 'month' : 'day',
        emptyText: 'No workouts in this period.',
      },
      {
        kind: 'hbar',
        title: 'Most logged exercises',
        unit: 'workouts',
        points: report.topExercises.map((e) => ({ label: e.exerciseName, value: e.workouts })),
        labelType: 'text',
        emptyText: 'No workouts in this period.',
      },
    ],
    tables: [
      {
        title: 'User statistics',
        sheetName: 'User Statistics',
        columns: [
          { header: 'Role', key: 'role', type: 'text' },
          { header: 'Total users', key: 'total', type: 'int' },
          { header: 'Active', key: 'active', type: 'int' },
          { header: 'Deactivated', key: 'inactive', type: 'int' },
          { header: 'New in period', key: 'newInPeriod', type: 'int' },
        ],
        rows: [
          ...report.users.byRole.map((r) => ({
            role: r.role,
            total: r.total,
            active: r.active,
            inactive: r.total - r.active,
            newInPeriod: report.registrations.byRole.find((x) => x.role === r.role)?.count ?? 0,
          })),
          { role: 'All roles', total: report.users.total, active: report.users.active, inactive: report.users.inactive, newInPeriod: report.registrations.inRange },
        ],
        emptyText: 'No users.',
      },
      {
        title: `Registrations per ${monthly ? 'month' : 'day'}`,
        sheetName: 'Registrations',
        columns: [
          { header: monthly ? 'Month' : 'Date', key: 'period', type: periodType },
          { header: 'New users', key: 'count', type: 'int' },
        ],
        rows: report.registrations.series.map((p) => ({ period: p.period, count: p.count })),
        pdfRows: report.registrations.series.filter((p) => p.count > 0).map((p) => ({ period: p.period, count: p.count })),
        pdfNote: `${monthly ? 'Months' : 'Days'} with at least one registration. The Excel export lists the whole period.`,
        emptyText: 'No registrations in this period.',
      },
      {
        title: `Workout activity per ${monthly ? 'month' : 'day'}`,
        sheetName: 'Workout Activity',
        columns: [
          { header: monthly ? 'Month' : 'Date', key: 'period', type: periodType },
          { header: 'Workouts', key: 'workouts', type: 'int' },
          { header: 'Minutes', key: 'minutes', type: 'int' },
        ],
        rows: report.activity.series.map((p) => ({ ...p })),
        pdfRows: report.activity.series.filter((p) => p.workouts > 0).map((p) => ({ ...p })),
        pdfNote: `${monthly ? 'Months' : 'Days'} with at least one workout. The Excel export lists the whole period.`,
        emptyText: 'No workouts in this period.',
      },
      {
        title: 'Most logged exercises',
        sheetName: 'Popular Exercises',
        columns: [
          { header: 'Rank', key: 'rank', type: 'int' },
          { header: 'Exercise', key: 'exerciseName', type: 'text' },
          { header: 'Category', key: 'category', type: 'text' },
          { header: 'Workouts', key: 'workouts', type: 'int' },
        ],
        rows: report.topExercises.map((e, i) => ({ rank: i + 1, exerciseName: e.exerciseName, category: e.category, workouts: e.workouts })),
        emptyText: 'No workouts in this period.',
      },
      {
        title: 'Trainer assignments',
        sheetName: 'Trainer Assignments',
        columns: [
          { header: 'Trainer', key: 'fullName', type: 'text' },
          { header: 'Assigned members', key: 'assignedMembers', type: 'int' },
        ],
        rows: report.assignments.trainers.map((t) => ({ fullName: t.fullName, assignedMembers: t.assignedMembers })),
        pdfNote: `${report.assignments.createdInRange} assignment(s) created in this period · ${report.assignments.unassignedActiveMembers} active member(s) without a trainer.`,
        emptyText: 'No trainer assignments.',
      },
    ],
    definitions: [
      'User totals are a snapshot at generation time; all other figures cover the selected period.',
      `Time series are grouped per ${monthly ? 'month (periods longer than 62 days)' : 'day'}.`,
      'Active members: members with at least one workout log in the period.',
    ],
    fileBase: `fitsync-system-report-${report.range.from}_${report.range.to}`,
  };
}

/** Text for a period/date cell in the PDF. */
export function cellText(type: ColumnType, value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'date':
      return longDate(String(value));
    case 'month':
      return monthLabel(String(value));
    case 'percent':
      return `${(Math.round(Number(value) * 1000) / 10).toLocaleString('en-US')}%`;
    case 'kg':
      // Weights are DECIMAL(5,2): show 1–2 decimals (65.5, 61.25), never round them away.
      return Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    case 'signedKg': {
      const n = Number(value);
      return `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    }
    case 'decimal':
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
    case 'int':
      return Math.round(Number(value)).toLocaleString('en-US');
    default:
      return String(value);
  }
}
