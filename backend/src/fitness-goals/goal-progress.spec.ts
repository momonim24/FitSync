import { addDays, evaluateGoal, goalWeeks, type GoalDefinition } from './goal-progress';

const weightGoal = (over: Partial<GoalDefinition> = {}): GoalDefinition => ({
  goalType: 'TargetWeight',
  startingValue: 80,
  targetValue: 75,
  startDate: '2026-11-01',
  targetDate: '2026-12-31',
  status: 'Active',
  ...over,
});
const weeklyGoal = (over: Partial<GoalDefinition> = {}): GoalDefinition => ({
  goalType: 'WeeklyWorkouts',
  startingValue: null,
  targetValue: 3,
  startDate: '2026-11-02',
  targetDate: '2026-11-15', // 2 goal weeks
  status: 'Active',
  ...over,
});
const w = (date: string, weightKg: number) => ({ date, weightKg });
const log = (date: string, durationMinutes = 30) => ({ date, durationMinutes });

describe('fitness goal progress', () => {
  describe('target weight', () => {
    it('measures weight loss as a share of the planned change', () => {
      const p = evaluateGoal(weightGoal(), '2026-11-20', { weights: [w('2026-11-05', 79), w('2026-11-19', 78)] });
      expect(p).toMatchObject({ state: 'InProgress', progressPercent: 40, currentValue: 78, achieved: false, closeAs: null });
      expect(p.weight).toMatchObject({ direction: 'loss', changeKg: -2, remainingKg: 3, measurements: 2 });
    });

    it('handles weight gain goals with the same formula', () => {
      const p = evaluateGoal(weightGoal({ startingValue: 60, targetValue: 64 }), '2026-11-20', { weights: [w('2026-11-18', 61)] });
      expect(p).toMatchObject({ progressPercent: 25, state: 'InProgress' });
      expect(p.weight).toMatchObject({ direction: 'gain', changeKg: 1, remainingKg: 3 });
    });

    it('shows 0 % (never negative) when weight moves the wrong way', () => {
      expect(evaluateGoal(weightGoal(), '2026-11-20', { weights: [w('2026-11-10', 82)] }).progressPercent).toBe(0);
      expect(evaluateGoal(weightGoal({ startingValue: 60, targetValue: 64 }), '2026-11-20', { weights: [w('2026-11-10', 58)] }).progressPercent).toBe(0);
    });

    it('is achieved by the first measurement that reaches the target, and stays achieved', () => {
      const p = evaluateGoal(weightGoal(), '2026-11-30', { weights: [w('2026-11-10', 77), w('2026-11-20', 74.8), w('2026-11-28', 75.6)] });
      expect(p).toMatchObject({ state: 'Achieved', achieved: true, achievedOn: '2026-11-20', progressPercent: 100, closeAs: 'Completed' });
    });

    it('reports NoData (null progress, not 0 %) without measurements in the goal period', () => {
      const p = evaluateGoal(weightGoal(), '2026-11-20', { weights: [w('2026-10-30', 79)] }); // before StartDate
      expect(p).toMatchObject({ state: 'NoData', progressPercent: null, currentValue: null, closeAs: null });
    });

    it('closes as Missed after the target date and ignores later measurements', () => {
      const p = evaluateGoal(weightGoal({ targetDate: '2026-11-30' }), '2026-12-05', { weights: [w('2026-11-20', 77), w('2026-12-03', 74)] });
      expect(p).toMatchObject({ state: 'Missed', achieved: false, closeAs: 'Missed', currentValue: 77, evaluatedThrough: '2026-11-30', daysRemaining: 0 });
    });

    it('is Upcoming before the start date', () => {
      expect(evaluateGoal(weightGoal(), '2026-10-20', { weights: [] })).toMatchObject({ state: 'Upcoming', progressPercent: null, timeElapsedPercent: 0 });
    });
  });

  describe('weekly frequency', () => {
    it('counts different workout days, not workout logs', () => {
      const p = evaluateGoal(weeklyGoal(), '2026-11-05', { workouts: [log('2026-11-02'), log('2026-11-02'), log('2026-11-02'), log('2026-11-04')] });
      expect(p.weekly!.currentWeek).toMatchObject({ index: 1, from: '2026-11-02', to: '2026-11-08', value: 2, met: false, percent: 66.7 });
      expect(p).toMatchObject({ state: 'OnTrack', progressPercent: 0, currentValue: 2, unit: 'workout days' });
    });

    it('becomes Behind when a finished week misses its target', () => {
      const p = evaluateGoal(weeklyGoal(), '2026-11-10', { workouts: [log('2026-11-02'), log('2026-11-09')] });
      expect(p.weekly).toMatchObject({ finishedWeeks: 1, weeksMet: 0 });
      expect(p.state).toBe('Behind');
    });

    it('is achieved when every goal week meets the target', () => {
      const workouts = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-12'].map((d) => log(d));
      const p = evaluateGoal(weeklyGoal(), '2026-11-13', { workouts });
      expect(p).toMatchObject({ state: 'Achieved', achieved: true, achievedOn: '2026-11-12', progressPercent: 100, closeAs: 'Completed' });
    });

    it('handles a goal with no recorded activity', () => {
      const p = evaluateGoal(weeklyGoal(), '2026-11-04', { workouts: [] });
      expect(p).toMatchObject({ state: 'OnTrack', progressPercent: 0, currentValue: 0 });
      const after = evaluateGoal(weeklyGoal(), '2026-11-20', { workouts: [] });
      expect(after).toMatchObject({ state: 'Missed', closeAs: 'Missed', progressPercent: 0 });
    });

    it('does not count workouts dated after today or outside the goal period', () => {
      const p = evaluateGoal(weeklyGoal(), '2026-11-03', { workouts: [log('2026-11-01'), log('2026-11-02'), log('2026-11-05')] });
      expect(p.weekly!.currentWeek!.value).toBe(1);
    });
  });

  describe('weekly duration', () => {
    it('sums minutes per goal week', () => {
      const goal = weeklyGoal({ goalType: 'WeeklyMinutes', targetValue: 90 });
      const p = evaluateGoal(goal, '2026-11-12', { workouts: [log('2026-11-02', 45), log('2026-11-03', 50), log('2026-11-10', 30), log('2026-11-10', 20)] });
      expect(p.weekly!.weeks.map((x) => [x.value, x.met])).toEqual([
        [95, true],
        [50, false],
      ]);
      expect(p).toMatchObject({ unit: 'minutes', progressPercent: 50, currentValue: 50, state: 'OnTrack' });
    });
  });

  it('keeps the stored outcome of goals that are no longer active', () => {
    expect(evaluateGoal(weightGoal({ status: 'Cancelled' }), '2026-11-20', { weights: [w('2026-11-10', 74)] })).toMatchObject({ state: 'Cancelled', closeAs: null });
    expect(evaluateGoal(weightGoal({ status: 'Completed' }), '2026-11-20', { weights: [] })).toMatchObject({ state: 'Achieved', closeAs: null });
  });

  it('computes goal weeks and dates', () => {
    expect(goalWeeks('2026-11-02', '2026-11-15')).toBe(2);
    expect(goalWeeks('2026-11-02', '2026-11-10')).toBeCloseTo(9 / 7);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  describe('stored status after records change (QA fix M1)', () => {
    it('Completed weight goal stays achieved after its record is deleted, and flags the change', () => {
      const p = evaluateGoal(weightGoal({ status: 'Completed', closedOn: '2026-11-10' }), '2026-11-20', { weights: [] });
      expect(p).toMatchObject({ state: 'Achieved', achieved: true, achievedOn: '2026-11-10', progressPercent: 100, evidenceChanged: true, liveProgressPercent: null, closeAs: null });
    });

    it('Completed goal whose records still meet the target is not flagged', () => {
      const p = evaluateGoal(weightGoal({ status: 'Completed', closedOn: '2026-11-12' }), '2026-11-20', { weights: [w('2026-11-10', 74.5)] });
      expect(p).toMatchObject({ state: 'Achieved', achievedOn: '2026-11-10', progressPercent: 100, evidenceChanged: false, liveProgressPercent: 100 });
    });

    it('Completed weekly goal keeps 100 % after a qualifying workout is deleted', () => {
      const p = evaluateGoal(weeklyGoal({ status: 'Completed', closedOn: '2026-11-15' }), '2026-11-20', { workouts: [log('2026-11-03')] });
      expect(p).toMatchObject({ state: 'Achieved', progressPercent: 100, evidenceChanged: true, liveProgressPercent: 0 });
    });

    it('Missed goal becomes Completed when late-logged records inside the period reach the target', () => {
      const workouts = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-10', '2026-11-11'].map((d) => log(d));
      const p = evaluateGoal(weeklyGoal({ status: 'Missed', closedOn: '2026-11-16' }), '2026-11-20', { workouts });
      expect(p).toMatchObject({ state: 'Achieved', achieved: true, progressPercent: 100, closeAs: 'Completed' });
    });

    it('Missed goal without enough records stays Missed with progress below 100 %', () => {
      const p = evaluateGoal(weeklyGoal({ status: 'Missed', closedOn: '2026-11-16' }), '2026-11-20', { workouts: ['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => log(d)) });
      expect(p).toMatchObject({ state: 'Missed', achieved: false, progressPercent: 50, closeAs: null, evidenceChanged: false });
    });

    it('records dated after the target date never rescue a Missed goal', () => {
      const p = evaluateGoal(weightGoal({ status: 'Missed', targetDate: '2026-11-15' }), '2026-11-20', { weights: [w('2026-11-18', 74)] });
      expect(p).toMatchObject({ state: 'Missed', closeAs: null });
    });

    it('Cancelled goals stay cancelled whatever the records show', () => {
      const p = evaluateGoal(weightGoal({ status: 'Cancelled' }), '2026-11-20', { weights: [w('2026-11-10', 74)] });
      expect(p).toMatchObject({ state: 'Cancelled', closeAs: null });
    });
  });
});
