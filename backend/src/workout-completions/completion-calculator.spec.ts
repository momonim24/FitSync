import { averagePercent, combinedCompletionPercent, combinedCompletionRatio, completionScore, toPercent, isTimed, statusForScore, summarizePlan, type LinkedAttempt } from './completion-calculator';

const attempt = (planExerciseId: number, score: number, workoutDate: string): LinkedAttempt<null> => ({ planExerciseId, score, workoutDate, data: null });

describe('completion calculator', () => {
  describe('completionScore', () => {
    it('is 1 when sets and repetitions meet the prescription', () => {
      expect(completionScore({ sets: 3, repetitions: 12 }, { sets: 3, reps: 12 })).toBe(1);
    });

    it('never exceeds 1 when the member does more than prescribed', () => {
      expect(completionScore({ sets: 5, repetitions: 20 }, { sets: 3, reps: 12 })).toBe(1);
    });

    it('multiplies the capped set and repetition ratios for partial work', () => {
      // 2/3 sets × 10/12 reps = 0.5556 -> 0.556
      expect(completionScore({ sets: 2, repetitions: 10 }, { sets: 3, reps: 12 })).toBeCloseTo(0.556, 3);
      // extra sets cannot make up for missing repetitions
      expect(completionScore({ sets: 6, repetitions: 6 }, { sets: 3, reps: 12 })).toBe(0.5);
    });

    it('is 0 for a log with 0 repetitions and for an invalid prescription', () => {
      expect(completionScore({ sets: 1, repetitions: 0 }, { sets: 1, reps: 1 })).toBe(0);
      expect(completionScore({ sets: 3, repetitions: 10 }, { sets: 0, reps: 10 })).toBe(0);
    });
  });

  describe('timed (duration-based) prescriptions', () => {
    it('uses sets and minutes and ignores repetitions', () => {
      // a 3 x 3-minute plank logged with 0 repetitions is complete
      expect(completionScore({ sets: 3, repetitions: 0, durationMinutes: 3 }, { sets: 3, reps: 1, durationMinutes: 3 })).toBe(1);
      expect(completionScore({ sets: 1, repetitions: 0, durationMinutes: 45 }, { sets: 1, reps: 1, durationMinutes: 30 })).toBe(1);
    });

    it('is partial when the time or the sets fall short', () => {
      expect(completionScore({ sets: 1, repetitions: 0, durationMinutes: 15 }, { sets: 1, reps: 1, durationMinutes: 30 })).toBe(0.5);
      expect(completionScore({ sets: 2, repetitions: 0, durationMinutes: 3 }, { sets: 3, reps: 1, durationMinutes: 3 })).toBeCloseTo(0.667, 3);
      expect(completionScore({ sets: 1, repetitions: 50, durationMinutes: 0 }, { sets: 1, reps: 1, durationMinutes: 30 })).toBe(0);
    });

    it('keeps the repetition rule when no duration target exists (backward compatible)', () => {
      expect(isTimed({ durationMinutes: null })).toBe(false);
      expect(isTimed({})).toBe(false);
      expect(completionScore({ sets: 1, repetitions: 0, durationMinutes: 30 }, { sets: 1, reps: 1, durationMinutes: null })).toBe(0);
      expect(completionScore({ sets: 3, repetitions: 12, durationMinutes: 1 }, { sets: 3, reps: 12 })).toBe(1);
    });
  });

  it('maps scores to statuses', () => {
    expect(statusForScore(null)).toBe('pending');
    expect(statusForScore(0)).toBe('partial');
    expect(statusForScore(0.99)).toBe('partial');
    expect(statusForScore(1)).toBe('completed');
  });

  describe('summarizePlan', () => {
    it('marks exercises completed / partial / pending and averages their best scores', () => {
      const summary = summarizePlan([1, 2, 3, 4], [attempt(1, 1, '2026-11-20'), attempt(2, 0.5, '2026-11-21'), attempt(3, 0.25, '2026-11-21')]);
      expect(summary.exercises.map((e) => e.status)).toEqual(['completed', 'partial', 'partial', 'pending']);
      expect(summary).toMatchObject({ prescribedExercises: 4, completedExercises: 1, partialExercises: 2, pendingExercises: 1 });
      // (1 + 0.5 + 0.25 + 0) / 4 = 43.75 % -> 43.8
      expect(summary.completionPercent).toBe(43.8);
    });

    it('counts repeated logs for the same exercise once, using the best attempt', () => {
      const summary = summarizePlan([1], [attempt(1, 0.5, '2026-11-20'), attempt(1, 1, '2026-11-21'), attempt(1, 0.75, '2026-11-22')]);
      expect(summary.completionPercent).toBe(100);
      expect(summary.exercises[0]).toMatchObject({ status: 'completed', attempts: 3 });
      expect(summary.exercises[0].best?.workoutDate).toBe('2026-11-21');
      expect(summary.exercises[0].latest?.workoutDate).toBe('2026-11-22');
    });

    it('ignores attempts for exercises that are no longer in the plan', () => {
      const summary = summarizePlan([1, 2], [attempt(9, 1, '2026-11-20')]);
      expect(summary.completionPercent).toBe(0);
      expect(summary.pendingExercises).toBe(2);
    });

    it('returns null completion (not 0 % or 100 %) for a plan without exercises', () => {
      expect(summarizePlan([], [attempt(1, 1, '2026-11-20')]).completionPercent).toBeNull();
    });
  });

  it('combines several plans so every prescribed exercise weighs the same', () => {
    const a = summarizePlan([1, 2], [attempt(1, 1, '2026-11-20')]); // 50 %
    const b = summarizePlan([3, 4, 5, 6], []); // 0 %
    expect(combinedCompletionPercent([a, b])).toBe(16.7); // 1 of 6 exercises
    expect(combinedCompletionPercent([summarizePlan([], [])])).toBeNull();
    expect(combinedCompletionPercent([])).toBeNull();
  });

  describe('rounding happens only at the end (QA fix L2)', () => {
    it('keeps scores unrounded', () => {
      expect(completionScore({ sets: 2, repetitions: 10 }, { sets: 3, reps: 10 })).toBe(2 / 3);
    });

    it('2/3 + pending averages to 33.3 %, not 33.4 %', () => {
      const summary = summarizePlan([1, 2], [attempt(1, 2 / 3, '2026-11-20')]);
      expect(summary.completionPercent).toBe(33.3);
      expect(summary.completionRatio).toBeCloseTo(1 / 3, 10);
    });

    it('(2/3 + 1) / 2 is 83.3 %, and (1/3 + 1) / 2 is 66.7 %', () => {
      expect(summarizePlan([1, 2], [attempt(1, 2 / 3, '2026-11-20'), attempt(2, 1, '2026-11-20')]).completionPercent).toBe(83.3);
      expect(summarizePlan([1, 2], [attempt(1, 1 / 3, '2026-11-20'), attempt(2, 1, '2026-11-20')]).completionPercent).toBe(66.7);
    });

    it('averages members from unrounded ratios and ignores members without plans', () => {
      // Exact mean of 2/3, 2/3 and 0 is 4/9 = 44.44 %; members without plans (null) are skipped.
      expect(averagePercent([2 / 3, 2 / 3, 0, null])).toBe(44.4);
      expect(averagePercent([1 / 3, 2 / 3])).toBe(50);
      expect(averagePercent([null])).toBeNull();
      expect(toPercent(2 / 3)).toBe(66.7);
    });

    it('combined ratio weighs every prescribed exercise equally', () => {
      const a = summarizePlan([1, 2], [attempt(1, 2 / 3, '2026-11-20')]);
      const b = summarizePlan([3], [attempt(3, 2 / 3, '2026-11-20')]);
      expect(combinedCompletionRatio([a, b])).toBeCloseTo(4 / 9, 10);
      expect(combinedCompletionPercent([a, b])).toBe(44.4);
    });
  });
});
