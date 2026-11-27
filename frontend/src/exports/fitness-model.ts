/**
 * Version 2.0 sections of the PDF / Excel report documents: workout plan
 * completion, fitness goals and trainer feedback COUNTS. Values are copied
 * from the report JSON (no calculation here). Feedback messages are never
 * exported — not even in member reports.
 */
import type { AdminReport, GoalState, GoalType, MemberReport, TrainerReport } from '../api/types';
import type { Metric, Table } from './model';

const GOAL_TYPE: Record<GoalType, string> = { TargetWeight: 'Target weight', WeeklyWorkouts: 'Weekly workout days', WeeklyMinutes: 'Weekly minutes' };
const GOAL_STATE: Record<GoalState, string> = {
  Upcoming: 'Upcoming',
  NoData: 'No data yet',
  InProgress: 'In progress',
  OnTrack: 'On track',
  Behind: 'Behind',
  Achieved: 'Achieved',
  Missed: 'Missed',
  Cancelled: 'Cancelled',
};
/** Percentages are stored as fractions for the 'percent' column type (0.5 = 50 %). */
const frac = (pct: number | null) => (pct === null ? null : pct / 100);
const pctText = (pct: number | null) => (pct === null ? '—' : `${pct}%`);

export const FITNESS_DEFINITIONS = [
  'Plan completion: for each prescribed exercise, the best workout logged from the plan in the period is scored. Repetition-based exercise: min(1, sets ÷ target sets) × min(1, reps ÷ target reps). Timed exercise (target minutes set, repetitions not used): min(1, sets ÷ target sets) × min(1, minutes ÷ target minutes). Completion is the average score over prescribed exercises, rounded only at the end (completed = 100 %, partial = below 100 %, pending = no workout). Workouts not logged from a plan never count.',
  'Goals: target weight progress = (latest − starting) ÷ (target − starting); weekly goals count workout days or minutes per 7-day goal week, and progress = weeks met ÷ goal weeks. Goal progress is evaluated on the generation date.',
  'Trainer feedback is reported as counts only; message content is private between trainer and member.',
];

// ===================================================================== member
export function memberFitnessMetrics(report: MemberReport): Metric[] {
  const pc = report.fitness.planCompletion;
  return [
    {
      label: 'Plan completion',
      value: frac(pc.completionPercent),
      unit: '% of prescription',
      display: pctText(pc.completionPercent),
      hint: pc.prescribedExercises ? `${pc.completedExercises} of ${pc.prescribedExercises} exercises completed` : 'No exercises prescribed',
      format: 'percent',
    },
  ];
}

export function memberFitnessTables(report: MemberReport): Table[] {
  const f = report.fitness;
  const pc = f.planCompletion;
  return [
    {
      title: 'Workout plan completion',
      sheetName: 'Plan Completion',
      columns: [
        { header: 'Plan', key: 'planName', type: 'text' },
        { header: 'Trainer', key: 'trainerName', type: 'text' },
        { header: 'Prescribed', key: 'prescribed', type: 'int' },
        { header: 'Completed', key: 'completed', type: 'int' },
        { header: 'Partial', key: 'partial', type: 'int' },
        { header: 'Pending', key: 'pending', type: 'int' },
        { header: 'Completion', key: 'completion', type: 'percent' },
      ],
      rows: pc.plans.map((p) => ({
        planName: p.planName,
        trainerName: p.trainerName,
        prescribed: p.prescribedExercises,
        completed: p.completedExercises,
        partial: p.partialExercises,
        pending: p.pendingExercises,
        completion: frac(p.completionPercent),
      })),
      pdfNote: `${pc.planWorkouts} workout(s) logged from plans and ${pc.otherWorkouts} other workout(s) in this period.`,
      emptyText: 'No workout plans.',
    },
    {
      title: 'Fitness goals',
      sheetName: 'Fitness Goals',
      columns: [
        { header: 'Goal', key: 'goalName', type: 'text' },
        { header: 'Type', key: 'type', type: 'text' },
        { header: 'Status', key: 'status', type: 'text' },
        { header: 'Target', key: 'target', type: 'text' },
        { header: 'Current', key: 'current', type: 'text' },
        { header: 'Progress', key: 'progress', type: 'percent' },
        { header: 'Target date', key: 'targetDate', type: 'date' },
      ],
      rows: f.goals.map((g) => ({
        goalName: g.goalName,
        type: GOAL_TYPE[g.goalType],
        status: g.status === 'Active' ? GOAL_STATE[g.state] : g.status,
        target: g.goalType === 'TargetWeight' ? `${g.startingValue} → ${g.targetValue} kg` : `${g.targetValue} ${g.unit} / week`,
        current:
          g.goalType === 'TargetWeight'
            ? g.currentValue === null
              ? 'No weight yet'
              : `${g.currentValue} kg`
            : `${g.weeksMet ?? 0} of ${g.totalWeeks ?? 0} weeks met`,
        progress: frac(g.progressPercent),
        targetDate: g.targetDate,
      })),
      pdfNote: `Goals whose period overlaps this report. ${f.feedback.receivedInPeriod} trainer feedback note(s) received in the period; ${f.feedback.unreadNow} unread now.`,
      emptyText: 'No fitness goals in this period.',
    },
  ];
}

// ==================================================================== trainer
export function trainerFitnessMetrics(report: TrainerReport): Metric[] {
  const s = report.fitness.summary;
  return [
    {
      label: 'Average plan completion',
      card: 'Avg. completion',
      value: frac(s.averageCompletionPercent),
      unit: '% of prescription',
      display: pctText(s.averageCompletionPercent),
      hint: `${s.membersWithPlans} member(s) with your plans`,
      format: 'percent',
    },
    { label: 'Feedback given in period', card: 'Feedback given', value: s.feedbackGiven, unit: 'notes', display: String(s.feedbackGiven), hint: `${s.activeGoals} active goals · ${s.goalsBehind} behind`, format: 'int' },
  ];
}

export function trainerFitnessTables(report: TrainerReport): Table[] {
  return [
    {
      title: 'Plan completion, goals and feedback by member',
      sheetName: 'Completion & Goals',
      columns: [
        { header: 'Member', key: 'member', type: 'text' },
        { header: 'Completion', key: 'completion', type: 'percent' },
        { header: 'Completed', key: 'completed', type: 'int' },
        { header: 'Partial', key: 'partial', type: 'int' },
        { header: 'Pending', key: 'pending', type: 'int' },
        { header: 'Active goals', key: 'activeGoals', type: 'int' },
        { header: 'Goals behind', key: 'behind', type: 'int' },
        { header: 'Feedback given', key: 'feedback', type: 'int' },
      ],
      rows: report.fitness.members.map((m) => ({
        member: m.member.fullName,
        completion: frac(m.completionPercent),
        completed: m.completedExercises,
        partial: m.partialExercises,
        pending: m.pendingExercises,
        activeGoals: m.activeGoals,
        behind: m.goalsBehind,
        feedback: m.feedbackGiven,
      })),
      emptyText: 'No assigned members.',
    },
  ];
}

// ====================================================================== admin
export function adminFitnessMetrics(report: AdminReport): Metric[] {
  const c = report.fitness.completion;
  const g = report.fitness.goals;
  return [
    {
      label: 'Average plan completion',
      card: 'Avg. completion',
      value: frac(c.averageCompletionPercent),
      unit: '% of prescription',
      display: pctText(c.averageCompletionPercent),
      hint: `${c.membersWithPlans} member(s) with plans`,
      format: 'percent',
    },
    { label: 'Goal achievement rate', card: 'Goals achieved', value: frac(g.achievementRatePercent), unit: '% of closed goals', display: pctText(g.achievementRatePercent), hint: `${g.byStatus.Active} active goals`, format: 'percent' },
  ];
}

export function adminFitnessTables(report: AdminReport): Table[] {
  const c = report.fitness.completion;
  const g = report.fitness.goals;
  const f = report.fitness.feedback;
  const countColumns = [
    { header: 'Metric', key: 'metric', type: 'text' as const },
    { header: 'Count', key: 'value', type: 'int' as const },
  ];
  const rateColumns = [
    { header: 'Metric', key: 'metric', type: 'text' as const },
    { header: 'Rate', key: 'value', type: 'percent' as const },
  ];
  const row = (metric: string, value: number | null) => ({ metric, value });
  return [
    {
      title: 'Fitness management (aggregates only)',
      sheetName: 'Fitness Management',
      columns: countColumns,
      rows: [
        row('Prescribed exercises (period)', c.prescribedExercises),
        row('Completed exercises', c.completedExercises),
        row('Partially completed exercises', c.partialExercises),
        row('Pending exercises', c.pendingExercises),
        row('Workouts logged from plans', c.planWorkouts),
        row('Other workouts', c.otherWorkouts),
        row('Goals — total', g.total),
        row('Goals — active', g.byStatus.Active),
        row('Goals — completed', g.byStatus.Completed),
        row('Goals — missed', g.byStatus.Missed),
        row('Goals — cancelled', g.byStatus.Cancelled),
        row('Feedback given (period)', f.total),
        row('Feedback read by members', f.read),
        row('Trainers giving feedback', f.trainersGivingFeedback),
        row('Members receiving feedback', f.membersReceivingFeedback),
        ...f.byType.map((t) => row(`Feedback type: ${t.feedbackType}`, t.count)),
      ],
      pdfNote: 'Counts only: no member names, goal names or feedback messages are included.',
      emptyText: 'No data.',
    },
    {
      title: 'Fitness management rates',
      sheetName: 'Fitness Rates',
      columns: rateColumns,
      rows: [
        row('Average plan completion (members with plans)', frac(c.averageCompletionPercent)),
        row('Goal achievement rate (completed ÷ closed)', frac(g.achievementRatePercent)),
        row('Average progress of active goals', frac(g.averageActiveProgressPercent)),
        row('Feedback read rate', frac(f.readRatePercent)),
      ],
      emptyText: 'No data.',
    },
  ];
}
