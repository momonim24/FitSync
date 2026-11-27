import { sectionsToCsv, type CsvCell } from './csv';
import { localDateOf } from '../common/utils/date.util';
import { ReportsService } from './reports.service';

type MemberReport = Awaited<ReturnType<ReportsService['memberReport']>>;
type TrainerReport = Awaited<ReturnType<ReportsService['trainerReport']>>;
type AdminReport = Awaited<ReturnType<ReportsService['adminReport']>>;

/*
 * CSV is the raw-data export: plain values, human-readable labels with units
 * in the label, and ISO dates (YYYY-MM-DD) everywhere so spreadsheets and
 * scripts parse them the same way in every locale. Visual formatting lives
 * in the Excel/PDF exports. Formula-injection escaping is applied by csv.ts.
 */

/** '2026-11-26T09:42:00.759Z' -> '2026-11-26 09:42 UTC' */
const utcStamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

const meta = (r: { range: { from: string; to: string; days: number }; generatedAt: string }): Array<[string, CsvCell]> => [
  ['Period start (YYYY-MM-DD)', r.range.from],
  ['Period end (YYYY-MM-DD)', r.range.to],
  ['Days in period', r.range.days],
  ['Generated', utcStamp(r.generatedAt)],
];

const MEMBER_SUMMARY_LABELS: Record<keyof MemberReport['summary'], string> = {
  totalWorkouts: 'Workouts',
  totalDurationMinutes: 'Training time (minutes)',
  totalSets: 'Sets',
  totalRepetitions: 'Repetitions (sets x reps per set)',
  distinctWorkoutDays: 'Workout days',
  consistencyPercent: 'Consistency (% of days)',
  averageMinutesPerWorkoutDay: 'Average minutes per workout day',
  averageWorkoutsPerWeek: 'Average workouts per week',
  longestStreakDays: 'Longest streak (days)',
};

const TRAINER_SUMMARY_LABELS: Record<keyof TrainerReport['summary'], string> = {
  assignedMembers: 'Assigned members',
  activeMembers: 'Active members (at least one workout)',
  totalWorkouts: 'Member workouts',
  totalDurationMinutes: 'Training time (minutes)',
  averageWorkoutsPerMember: 'Average workouts per member',
  averageConsistencyPercent: 'Average consistency (% of days)',
  plansCreatedInRange: 'Workout plans created in period',
};

const ADMIN_USAGE_LABELS: Record<keyof AdminReport['usage'], string> = {
  workoutLogs: 'Workout logs recorded',
  progressRecords: 'Progress records',
  workoutPlansCreated: 'Workout plans created',
  exercisesImported: 'Exercises imported from wger',
  activeUsers: 'Members with activity',
};

const labelled = <T extends object>(values: T, labels: Record<keyof T, string>): CsvCell[][] =>
  (Object.keys(labels) as Array<keyof T>).map((key) => [labels[key], values[key] as unknown as CsvCell]);


// ---------------------------------------------------------------- Version 2.0 sections
const GOAL_TYPE_LABELS: Record<string, string> = { TargetWeight: 'Target weight', WeeklyWorkouts: 'Weekly workout days', WeeklyMinutes: 'Weekly minutes' };
const GOAL_STATE_LABELS: Record<string, string> = {
  Upcoming: 'Upcoming',
  NoData: 'No data yet',
  InProgress: 'In progress',
  OnTrack: 'On track',
  Behind: 'Behind',
  Achieved: 'Achieved',
  Missed: 'Missed',
  Cancelled: 'Cancelled',
};

type Section = { title: string; header: string[]; rows: CsvCell[][] };

function memberFitnessSections(f: MemberReport['fitness']): Section[] {
  const pc = f.planCompletion;
  return [
    {
      title: 'Workout plan completion',
      header: ['Metric', 'Value'],
      rows: [
        ['Plan completion (%)', pc.completionPercent],
        ['Prescribed exercises', pc.prescribedExercises],
        ['Completed exercises', pc.completedExercises],
        ['Partially completed exercises', pc.partialExercises],
        ['Pending exercises', pc.pendingExercises],
        ['Workouts logged from plans', pc.planWorkouts],
        ['Other workouts', pc.otherWorkouts],
      ],
    },
    {
      title: 'Plan completion by plan',
      header: ['Plan', 'Trainer', 'Prescribed exercises', 'Completed', 'Partial', 'Pending', 'Completion (%)'],
      rows: pc.plans.map((p) => [p.planName, p.trainerName, p.prescribedExercises, p.completedExercises, p.partialExercises, p.pendingExercises, p.completionPercent]),
    },
    {
      title: 'Fitness goals (progress on the generation date)',
      header: ['Goal', 'Type', 'Status', 'Progress state', 'Start date (YYYY-MM-DD)', 'Target date (YYYY-MM-DD)', 'Starting value', 'Target value', 'Current value', 'Unit', 'Progress (%)', 'Weeks met', 'Goal weeks'],
      rows: f.goals.map((g) => [
        g.goalName,
        GOAL_TYPE_LABELS[g.goalType] ?? g.goalType,
        g.status,
        GOAL_STATE_LABELS[g.state] ?? g.state,
        g.startDate,
        g.targetDate,
        g.startingValue,
        g.targetValue,
        g.currentValue,
        g.unit,
        g.progressPercent,
        g.weeksMet,
        g.totalWeeks,
      ]),
    },
    {
      title: 'Trainer feedback (counts only)',
      header: ['Metric', 'Value'],
      rows: [
        ['Feedback received in period', f.feedback.receivedInPeriod],
        ['Unread feedback (now)', f.feedback.unreadNow],
      ],
    },
  ];
}

export function memberReportCsv(r: MemberReport): string {
  return sectionsToCsv(`FitSync member report — ${r.member.fullName}`, [['Member', r.member.fullName], ['Email', r.member.email], ...meta(r)], [
    { title: 'Summary', header: ['Metric', 'Value'], rows: labelled(r.summary, MEMBER_SUMMARY_LABELS) },
    {
      title: 'Weight',
      header: ['Weight records', 'First record date', 'First weight (kg)', 'Last record date', 'Last weight (kg)', 'Weight change (kg)', 'Lowest weight (kg)', 'Highest weight (kg)'],
      rows: [[r.weight.measurements, r.weight.startDate, r.weight.startWeightKg, r.weight.endDate, r.weight.endWeightKg, r.weight.changeKg, r.weight.minKg, r.weight.maxKg]],
    },
    {
      title: 'Exercise frequency',
      header: ['Exercise', 'Category', 'Workouts', 'Sets', 'Repetitions', 'Minutes'],
      rows: r.exerciseFrequency.map((e) => [e.exerciseName, e.category, e.workouts, e.sets, e.repetitions, e.minutes]),
    },
    {
      title: 'Category breakdown',
      header: ['Category', 'Workouts', 'Share of workouts (%)', 'Minutes'],
      rows: r.categoryBreakdown.map((c) => [c.category, c.workouts, c.percent, c.minutes]),
    },
    { title: 'Daily activity', header: ['Date (YYYY-MM-DD)', 'Workouts', 'Minutes'], rows: r.daily.map((d) => [d.date, d.workouts, d.minutes]) },
    { title: 'Weight records', header: ['Date (YYYY-MM-DD)', 'Weight (kg)'], rows: r.weight.trend.map((t) => [t.date, t.weightKg]) },
    { title: 'Progress notes', header: ['Date (YYYY-MM-DD)', 'Notes'], rows: r.notes.map((n) => [n.date, n.notes]) },
    ...memberFitnessSections(r.fitness),
  ]);
}

export function trainerReportCsv(r: TrainerReport): string {
  return sectionsToCsv(`FitSync trainer report — ${r.trainer.fullName}`, [['Trainer', r.trainer.fullName], ['Email', r.trainer.email], ...meta(r)], [
    { title: 'Summary', header: ['Metric', 'Value'], rows: labelled(r.summary, TRAINER_SUMMARY_LABELS) },
    {
      title: 'Assigned members',
      header: [
        'Member',
        'Email',
        'Assigned on (YYYY-MM-DD)',
        'Workouts',
        'Training time (minutes)',
        'Sets',
        'Repetitions',
        'Workout days',
        'Consistency (% of days)',
        'Last workout (YYYY-MM-DD)',
        'Latest weight (kg)',
        'Weight change (kg)',
        'Workout plans',
      ],
      rows: r.members.map((m) => [
        m.member.fullName,
        m.member.email,
        localDateOf(m.assignedAt),
        m.totalWorkouts,
        m.totalDurationMinutes,
        m.totalSets,
        m.totalRepetitions,
        m.distinctWorkoutDays,
        m.consistencyPercent,
        m.lastWorkoutDate,
        m.latestWeightKg,
        m.weightChangeKg,
        m.planCount,
      ]),
    },
    { title: 'Daily activity (all assigned members)', header: ['Date (YYYY-MM-DD)', 'Workouts', 'Minutes'], rows: r.daily.map((d) => [d.date, d.workouts, d.minutes]) },
    {
      title: 'Fitness management summary',
      header: ['Metric', 'Value'],
      rows: [
        ['Average plan completion (%)', r.fitness.summary.averageCompletionPercent],
        ['Members with your plans', r.fitness.summary.membersWithPlans],
        ['Active member goals', r.fitness.summary.activeGoals],
        ['Goals behind', r.fitness.summary.goalsBehind],
        ['Feedback given in period', r.fitness.summary.feedbackGiven],
      ],
    },
    {
      title: 'Plan completion and goals by member',
      header: [
        'Member',
        'Plan completion (%)',
        'Prescribed exercises',
        'Completed',
        'Partial',
        'Pending',
        'Workouts logged from plans',
        'Active goals',
        'Goals behind',
        'Goals achieved in period',
        'Feedback given in period',
        'Feedback not yet read',
      ],
      rows: r.fitness.members.map((m) => [
        m.member.fullName,
        m.completionPercent,
        m.prescribedExercises,
        m.completedExercises,
        m.partialExercises,
        m.pendingExercises,
        m.planWorkouts,
        m.activeGoals,
        m.goalsBehind,
        m.goalsCompletedInPeriod,
        m.feedbackGiven,
        m.feedbackUnread,
      ]),
    },
  ]);
}

export function adminReportCsv(r: AdminReport): string {
  const periodHeader = r.seriesGranularity === 'month' ? 'Month (YYYY-MM)' : 'Date (YYYY-MM-DD)';
  return sectionsToCsv('FitSync system report', meta(r), [
    {
      title: 'Users by role',
      header: ['Role', 'Total users', 'Active users', 'Deactivated users', 'New in period'],
      rows: [
        ...r.users.byRole.map((u) => [u.role, u.total, u.active, u.total - u.active, r.registrations.byRole.find((x) => x.role === u.role)?.count ?? 0]),
        ['All roles', r.users.total, r.users.active, r.users.inactive, r.registrations.inRange],
      ],
    },
    { title: `Registrations per ${r.seriesGranularity}`, header: [periodHeader, 'New users'], rows: r.registrations.series.map((x) => [x.period, x.count]) },
    {
      title: 'Workout activity',
      header: ['Metric', 'Value'],
      rows: [
        ['Workouts logged', r.activity.totalWorkouts],
        ['Training time (minutes)', r.activity.totalDurationMinutes],
        ['Active members (at least one workout)', r.activity.activeMembers],
        ['Average workouts per active member', r.activity.averageWorkoutsPerActiveMember],
      ],
    },
    { title: `Workouts per ${r.seriesGranularity}`, header: [periodHeader, 'Workouts', 'Training time (minutes)'], rows: r.activity.series.map((x) => [x.period, x.workouts, x.minutes]) },
    { title: 'Most logged exercises', header: ['Rank', 'Exercise', 'Category', 'Workouts'], rows: r.topExercises.map((e, i) => [i + 1, e.exerciseName, e.category, e.workouts]) },
    {
      title: 'Trainer assignments',
      header: ['Trainer', 'Assigned members'],
      rows: r.assignments.trainers.map((t) => [t.fullName, t.assignedMembers]),
    },
    {
      title: 'Assignment statistics',
      header: ['Metric', 'Value'],
      rows: [
        ['Total trainer assignments', r.assignments.total],
        ['Assignments created in period', r.assignments.createdInRange],
        ['Average members per trainer', r.assignments.averageMembersPerTrainer],
        ['Active members without a trainer', r.assignments.unassignedActiveMembers],
      ],
    },
    { title: 'System usage in period', header: ['Metric', 'Value'], rows: labelled(r.usage, ADMIN_USAGE_LABELS) },
    {
      title: 'Workout plan completion in period',
      header: ['Metric', 'Value'],
      rows: [
        ['Members with prescribed exercises', r.fitness.completion.membersWithPlans],
        ['Average plan completion (%)', r.fitness.completion.averageCompletionPercent],
        ['Prescribed exercises', r.fitness.completion.prescribedExercises],
        ['Completed exercises', r.fitness.completion.completedExercises],
        ['Partially completed exercises', r.fitness.completion.partialExercises],
        ['Pending exercises', r.fitness.completion.pendingExercises],
        ['Workouts logged from plans', r.fitness.completion.planWorkouts],
        ['Other workouts', r.fitness.completion.otherWorkouts],
      ],
    },
    {
      title: 'Fitness goals (current, all members)',
      header: ['Metric', 'Value'],
      rows: [
        ['Total goals', r.fitness.goals.total],
        ['Active', r.fitness.goals.byStatus.Active],
        ['Active and on track', r.fitness.goals.activeByState.onTrack],
        ['Active and behind', r.fitness.goals.activeByState.behind],
        ['Completed', r.fitness.goals.byStatus.Completed],
        ['Missed', r.fitness.goals.byStatus.Missed],
        ['Cancelled', r.fitness.goals.byStatus.Cancelled],
        ['Achievement rate (%)', r.fitness.goals.achievementRatePercent],
        ['Average progress of active goals (%)', r.fitness.goals.averageActiveProgressPercent],
        ['Members with active goals', r.fitness.goals.membersWithActiveGoals],
      ],
    },
    {
      title: 'Goals by type',
      header: ['Goal type', 'Total', 'Active', 'Completed'],
      rows: r.fitness.goals.byType.map((t) => [GOAL_TYPE_LABELS[t.goalType] ?? t.goalType, t.total, t.active, t.completed]),
    },
    {
      title: 'Trainer feedback in period (counts only, no message content)',
      header: ['Metric', 'Value'],
      rows: [
        ['Feedback given', r.fitness.feedback.total],
        ['Read by members', r.fitness.feedback.read],
        ['Not yet read', r.fitness.feedback.unread],
        ['Read rate (%)', r.fitness.feedback.readRatePercent],
        ['Trainers giving feedback', r.fitness.feedback.trainersGivingFeedback],
        ['Members receiving feedback', r.fitness.feedback.membersReceivingFeedback],
        ['About a goal', r.fitness.feedback.aboutGoals],
        ['About a workout plan', r.fitness.feedback.aboutPlans],
        ...r.fitness.feedback.byType.map((t): CsvCell[] => [`Type: ${t.feedbackType}`, t.count]),
      ],
    },
  ]);
}
