/*
 * WORKOUT PLAN COMPLETION — definitions (pure functions, unit tested).
 *
 * 1. A completion links one workout log to one prescribed plan exercise.
 *    Its score compares what was done with the prescription in force when
 *    the workout was counted. There are two kinds of prescription:
 *
 *    a) Repetition-based (TargetDurationMinutes NULL — every Lab 04 row):
 *      score = min(1, actualSets ÷ prescribedSets) × min(1, actualReps ÷ prescribedReps)
 *
 *    b) Duration-based (TargetDurationMinutes set — timed exercises such as
 *       a plank, a run or a mobility flow; migration 003):
 *      score = min(1, actualSets ÷ prescribedSets) × min(1, actualMinutes ÷ prescribedMinutes)
 *       Repetitions are NOT used, so a timed workout is logged with 0 reps.
 *       prescribedMinutes is the total time for the exercise in one session.
 *
 *    score = 1  -> the prescription was fully met ("completed")
 *    score < 1  -> attempted but below target ("partial"), including 0 when
 *                  a repetition-based exercise is logged with 0 repetitions
 *    Doing more than prescribed never scores above 1.
 *    Scores are kept UNROUNDED; only displayed percentages are rounded
 *    (to 1 decimal), so averages are never built from rounded values.
 *
 * 2. Within a period (from..to, inclusive, by WorkoutDate) each plan
 *    exercise takes the BEST score among its linked logs in that period:
 *      completed  best score = 1
 *      partial    at least one linked log, best score < 1
 *      pending    no linked log in the period
 *    Several logs for the same plan exercise never add up (no double
 *    counting); a log can only be linked once (UNIQUE LogID).
 *
 * 3. Plan completion % = 100 × Σ(best score per plan exercise) ÷ number of
 *    plan exercises, rounded to 1 decimal. A plan without exercises has
 *    completion null ("nothing prescribed"), never 0 % or 100 %.
 *
 * 4. Unrelated workouts (logs not linked to the plan) never count.
 */

export type ExerciseCompletionStatus = 'completed' | 'partial' | 'pending';

export interface Prescription {
  sets: number;
  reps: number;
  /** Total minutes for a timed exercise; null/undefined = repetition-based. */
  durationMinutes?: number | null;
}

export interface Performance {
  sets: number;
  repetitions: number;
  durationMinutes?: number;
}

/** Is this a duration-based (timed) prescription? */
export const isTimed = (p: Pick<Prescription, 'durationMinutes'>) => p.durationMinutes !== null && p.durationMinutes !== undefined;

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Display rounding of a 0..1 score as a percentage with 1 decimal. */
export const toPercent = (score: number) => round1(score * 100);

/** Score of one linked log against its prescription, 0..1. */
export function completionScore(actual: Performance, prescribed: Prescription): number {
  if (!(prescribed.sets > 0)) return 0;
  const sets = Math.min(1, Math.max(0, actual.sets) / prescribed.sets);
  if (isTimed(prescribed)) {
    if (!((prescribed.durationMinutes as number) > 0)) return 0;
    const minutes = Math.max(0, actual.durationMinutes ?? 0) / (prescribed.durationMinutes as number);
    return sets * Math.min(1, minutes);
  }
  if (!(prescribed.reps > 0)) return 0;
  const reps = Math.max(0, actual.repetitions) / prescribed.reps;
  return sets * Math.min(1, reps);
}

export function statusForScore(score: number | null): ExerciseCompletionStatus {
  if (score === null) return 'pending';
  return score >= 1 ? 'completed' : 'partial';
}

export interface LinkedAttempt<T = unknown> {
  planExerciseId: number;
  score: number;
  workoutDate: string;
  data: T;
}

export interface ExerciseSummary<T> {
  planExerciseId: number;
  status: ExerciseCompletionStatus;
  score: number;
  attempts: number;
  best: LinkedAttempt<T> | null;
  latest: LinkedAttempt<T> | null;
}

export interface PlanSummary<T> {
  prescribedExercises: number;
  completedExercises: number;
  partialExercises: number;
  pendingExercises: number;
  completionPercent: number | null;
  /** Unrounded mean score (0..1) used for further averaging. */
  completionRatio: number | null;
  exercises: ExerciseSummary<T>[];
}

/**
 * Summarises one plan for a period. `attempts` must already be limited to
 * the period; attempts for plan exercises not in `planExerciseIds` are ignored.
 */
export function summarizePlan<T>(planExerciseIds: number[], attempts: LinkedAttempt<T>[]): PlanSummary<T> {
  const exercises = planExerciseIds.map((planExerciseId): ExerciseSummary<T> => {
    const mine = attempts.filter((a) => a.planExerciseId === planExerciseId);
    if (mine.length === 0) return { planExerciseId, status: 'pending', score: 0, attempts: 0, best: null, latest: null };
    const best = mine.reduce((b, a) => (a.score > b.score || (a.score === b.score && a.workoutDate > b.workoutDate) ? a : b));
    const latest = mine.reduce((l, a) => (a.workoutDate > l.workoutDate ? a : l));
    return { planExerciseId, status: statusForScore(best.score), score: best.score, attempts: mine.length, best, latest };
  });
  const count = (s: ExerciseCompletionStatus) => exercises.filter((e) => e.status === s).length;
  return {
    prescribedExercises: exercises.length,
    completedExercises: count('completed'),
    partialExercises: count('partial'),
    pendingExercises: count('pending'),
    completionPercent: exercises.length ? toPercent(exercises.reduce((s, e) => s + e.score, 0) / exercises.length) : null,
    completionRatio: exercises.length ? exercises.reduce((s, e) => s + e.score, 0) / exercises.length : null,
    exercises,
  };
}

/**
 * Combined completion over several plans: every prescribed exercise weighs
 * the same. null when nothing is prescribed.
 */
export function combinedCompletionPercent(plans: Array<{ exercises: Array<{ score: number }> }>): number | null {
  const ratio = combinedCompletionRatio(plans);
  return ratio === null ? null : toPercent(ratio);
}

/** Unrounded combined mean score (0..1), or null when nothing is prescribed. */
export function combinedCompletionRatio(plans: Array<{ exercises: Array<{ score: number }> }>): number | null {
  const scores = plans.flatMap((p) => p.exercises.map((e) => e.score));
  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

/** Mean of several unrounded ratios as a displayed percentage (nulls ignored). */
export function averagePercent(ratios: Array<number | null>): number | null {
  const values = ratios.filter((r): r is number => r !== null);
  return values.length ? toPercent(values.reduce((s, v) => s + v, 0) / values.length) : null;
}
