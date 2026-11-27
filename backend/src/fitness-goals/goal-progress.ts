/*
 * FITNESS GOAL PROGRESS — definitions (pure functions, unit tested).
 *
 * Progress is always calculated from data the member already records
 * (ProgressRecords for weight, WorkoutLogs for activity). Nothing is typed
 * in twice and nothing is "recommended": FitSync only measures the goal the
 * member set.
 *
 * TargetWeight (kg)
 *   direction      loss when TargetValue < StartingValue, gain when greater
 *                  (equal values are rejected when the goal is saved)
 *   measurements   weight records dated StartDate..min(today, TargetDate)
 *   current        the latest of those measurements
 *   progress %     (current − start) ÷ (target − start) × 100, clamped to
 *                  0..100 — the same formula works for loss and gain, and a
 *                  move in the wrong direction shows 0 %, never negative
 *   achieved       the first measurement at/below (loss) or at/above (gain)
 *                  the target; the goal is then Completed (100 %)
 *   no data        no measurement in the window -> progress null, state NoData
 *   missed         TargetDate passed without reaching the target
 *
 * WeeklyWorkouts / WeeklyMinutes
 *   goal weeks     consecutive 7-day blocks starting on StartDate (the goal
 *                  period must be a whole number of weeks)
 *   week value     WeeklyWorkouts: number of DIFFERENT days with ≥ 1 workout
 *                  (several exercises on one day = one workout day)
 *                  WeeklyMinutes: SUM(DurationMinutes) of the week's logs
 *   week met       value ≥ TargetValue
 *   progress %     weeks met ÷ total weeks × 100
 *   achieved       every goal week met (Completed as soon as the last week
 *                  reaches its target)
 *   behind         a finished week missed its target (the goal can no longer
 *                  be fully achieved; it closes as Missed after TargetDate)
 *   no activity    weeks simply count 0 — a real value, not missing data
 *
 * Shared: before StartDate the goal is Upcoming (progress null). Division by
 * zero cannot happen: target − start ≠ 0 and TargetValue > 0 are enforced.
 *
 * STORED STATUS AFTER DATA CHANGES (QA fix M1) — progress is always measured
 * from the current records, and the stored status follows these rules so
 * the status and the displayed progress never contradict each other:
 *   Active     live; becomes Completed when the target is reached, Missed
 *              when the target date passes without reaching it.
 *   Completed  a permanent achievement: it is never reopened or erased.
 *              Progress is shown as 100 % / Achieved. If the records that met
 *              the target are later edited or deleted, evidenceChanged = true
 *              and liveProgressPercent shows today's measurement.
 *   Missed     re-checked against records dated INSIDE the goal period: if
 *              late-logged records show the target was in fact reached, it
 *              becomes Completed (an achievement is recorded, never removed).
 *              Otherwise it stays Missed with progress below 100 %.
 *   Cancelled  the member's decision is kept; progress is informational.
 */

export const GOAL_TYPES = ['TargetWeight', 'WeeklyWorkouts', 'WeeklyMinutes'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GOAL_STATUSES = ['Active', 'Completed', 'Missed', 'Cancelled'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalState = 'Upcoming' | 'NoData' | 'InProgress' | 'OnTrack' | 'Behind' | 'Achieved' | 'Missed' | 'Cancelled';

export interface GoalDefinition {
  goalType: GoalType;
  startingValue: number | null;
  targetValue: number;
  startDate: string;
  targetDate: string;
  status: GoalStatus;
  /** App-time-zone day the stored status was closed (Completed/Missed/Cancelled). */
  closedOn?: string | null;
}

export interface WeightPoint {
  date: string;
  weightKg: number;
}

export interface WorkoutPoint {
  date: string;
  durationMinutes: number;
}

export interface GoalWeek {
  index: number;
  from: string;
  to: string;
  value: number;
  target: number;
  met: boolean;
  finished: boolean;
  percent: number;
}

export interface GoalProgress {
  state: GoalState;
  achieved: boolean;
  achievedOn: string | null;
  progressPercent: number | null;
  currentValue: number | null;
  unit: 'kg' | 'workout days' | 'minutes';
  evaluatedThrough: string;
  timeElapsedPercent: number;
  daysRemaining: number;
  /** The persisted status the goal should move to now, if any (Active -> Completed/Missed, Missed -> Completed). */
  closeAs: 'Completed' | 'Missed' | null;
  /** Closed goals: today's measurement disagrees with the stored outcome (records changed after closing). */
  evidenceChanged: boolean;
  /** Progress measured from the current records, even when the stored outcome overrides progressPercent. */
  liveProgressPercent: number | null;
  weight: {
    direction: 'loss' | 'gain';
    startingKg: number;
    targetKg: number;
    latestKg: number | null;
    latestDate: string | null;
    changeKg: number | null;
    remainingKg: number | null;
    measurements: number;
  } | null;
  weekly: {
    totalWeeks: number;
    finishedWeeks: number;
    weeksMet: number;
    currentWeek: GoalWeek | null;
    weeks: GoalWeek[];
  } | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
/** Whole days from a to b (b − a). */
export const dayDiff = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
export const addDays = (date: string, days: number) => new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);

/** Number of 7-day goal weeks in StartDate..TargetDate (inclusive). */
export const goalWeeks = (startDate: string, targetDate: string) => (dayDiff(startDate, targetDate) + 1) / 7;

export function evaluateGoal(goal: GoalDefinition, today: string, data: { weights?: WeightPoint[]; workouts?: WorkoutPoint[] }): GoalProgress {
  const totalDays = dayDiff(goal.startDate, goal.targetDate) + 1;
  const evaluatedThrough = today < goal.targetDate ? today : goal.targetDate;
  const base = {
    evaluatedThrough,
    timeElapsedPercent: round1(clamp(((dayDiff(goal.startDate, today) + 1) / totalDays) * 100, 0, 100)),
    daysRemaining: Math.max(0, dayDiff(today, goal.targetDate)),
  };
  const result = goal.goalType === 'TargetWeight' ? evaluateWeight(goal, today, evaluatedThrough, data.weights ?? []) : evaluateWeekly(goal, today, data.workouts ?? []);
  const progress: GoalProgress = { ...result, ...base, evidenceChanged: false, liveProgressPercent: result.progressPercent };

  switch (goal.status) {
    case 'Cancelled':
      return { ...progress, state: 'Cancelled', closeAs: null };
    case 'Completed':
      // Permanent achievement; flag (never hide) records that changed afterwards.
      return {
        ...progress,
        state: 'Achieved',
        achieved: true,
        achievedOn: progress.achieved ? progress.achievedOn : (goal.closedOn ?? progress.achievedOn),
        progressPercent: 100,
        closeAs: null,
        evidenceChanged: !progress.achieved,
      };
    case 'Missed':
      // Late-logged records inside the goal period can turn it into an achievement.
      if (progress.achieved) return { ...progress, state: 'Achieved', closeAs: 'Completed', evidenceChanged: true };
      return { ...progress, state: 'Missed', closeAs: null };
    default:
      return progress;
  }
}

type PartialProgress = Omit<GoalProgress, 'evaluatedThrough' | 'timeElapsedPercent' | 'daysRemaining' | 'evidenceChanged' | 'liveProgressPercent'>;

function evaluateWeight(goal: GoalDefinition, today: string, through: string, weights: WeightPoint[]): PartialProgress {
  const start = goal.startingValue ?? 0;
  const target = goal.targetValue;
  const direction = target < start ? 'loss' : 'gain';
  const window = weights.filter((w) => w.date >= goal.startDate && w.date <= through).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const reached = (kg: number) => (direction === 'loss' ? kg <= target : kg >= target);
  const hit = window.find((w) => reached(w.weightKg)) ?? null;
  const latest = window.at(-1) ?? null;
  const span = target - start; // never 0: rejected on save
  const upcoming = today < goal.startDate;
  const pastDeadline = today > goal.targetDate;

  let state: GoalState;
  let progressPercent: number | null;
  if (upcoming) {
    state = 'Upcoming';
    progressPercent = null;
  } else if (hit) {
    state = 'Achieved';
    progressPercent = 100;
  } else if (!latest) {
    state = pastDeadline ? 'Missed' : 'NoData';
    progressPercent = null;
  } else {
    state = pastDeadline ? 'Missed' : 'InProgress';
    progressPercent = span === 0 ? null : round1(clamp(((latest.weightKg - start) / span) * 100, 0, 100));
  }

  return {
    state,
    achieved: Boolean(hit),
    achievedOn: hit?.date ?? null,
    progressPercent,
    currentValue: latest?.weightKg ?? null,
    unit: 'kg',
    closeAs: hit ? 'Completed' : pastDeadline ? 'Missed' : null,
    weight: {
      direction,
      startingKg: start,
      targetKg: target,
      latestKg: latest?.weightKg ?? null,
      latestDate: latest?.date ?? null,
      changeKg: latest ? round2(latest.weightKg - start) : null,
      remainingKg: latest ? round2(Math.max(0, direction === 'loss' ? latest.weightKg - target : target - latest.weightKg)) : null,
      measurements: window.length,
    },
    weekly: null,
  };
}

function evaluateWeekly(goal: GoalDefinition, today: string, workouts: WorkoutPoint[]): PartialProgress {
  const totalWeeks = Math.max(1, Math.ceil(goalWeeks(goal.startDate, goal.targetDate)));
  const target = goal.targetValue;
  const byMinutes = goal.goalType === 'WeeklyMinutes';
  let achievedOn: string | null = null;

  const weeks: GoalWeek[] = Array.from({ length: totalWeeks }, (_, index) => {
    const from = addDays(goal.startDate, index * 7);
    const last = addDays(from, 6);
    const to = last < goal.targetDate ? last : goal.targetDate;
    const counted = workouts.filter((w) => w.date >= from && w.date <= to && w.date <= today);
    // Day-by-day running total to know WHEN the week's target was reached.
    const days = [...new Set(counted.map((w) => w.date))].sort();
    let running = 0;
    let reachedOn: string | null = null;
    for (const day of days) {
      running += byMinutes ? counted.filter((w) => w.date === day).reduce((s, w) => s + w.durationMinutes, 0) : 1;
      if (reachedOn === null && running >= target) reachedOn = day;
    }
    const value = running;
    const met = value >= target;
    if (met && reachedOn && (achievedOn === null || reachedOn > achievedOn)) achievedOn = reachedOn;
    return { index: index + 1, from, to, value, target, met, finished: to < today, percent: round1(clamp((value / target) * 100, 0, 100)) };
  });

  const weeksMet = weeks.filter((w) => w.met).length;
  const finishedWeeks = weeks.filter((w) => w.finished).length;
  const achieved = weeksMet === totalWeeks;
  const currentWeek = weeks.find((w) => w.from <= today && today <= w.to) ?? null;
  const pastDeadline = today > goal.targetDate;

  let state: GoalState;
  if (today < goal.startDate) state = 'Upcoming';
  else if (achieved) state = 'Achieved';
  else if (pastDeadline) state = 'Missed';
  else if (weeks.some((w) => w.finished && !w.met)) state = 'Behind';
  else state = 'OnTrack';

  return {
    state,
    achieved,
    achievedOn: achieved ? achievedOn : null,
    progressPercent: today < goal.startDate ? null : round1((weeksMet / totalWeeks) * 100),
    currentValue: currentWeek?.value ?? null,
    unit: byMinutes ? 'minutes' : 'workout days',
    closeAs: achieved ? 'Completed' : pastDeadline ? 'Missed' : null,
    weight: null,
    weekly: { totalWeeks, finishedWeeks, weeksMet, currentWeek, weeks },
  };
}
