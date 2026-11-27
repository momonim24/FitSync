/**
 * FitSync Version 2.0 e2e tests — fitness management:
 *   - Workout plan completion tracking (WorkoutCompletions)
 *   - Fitness goal management (FitnessGoals)
 *   - Trainer feedback (TrainerFeedback)
 *   - Dashboard and report additions
 *
 * Runs the real AppModule against the MySQL test database (fitsync_test_db).
 * Uses its own *@fitness.test accounts so it is independent of the other suites.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Role } from '../src/common/enums';
import { daysFromToday } from '../src/common/utils/date.util';
import { FitnessGoal } from '../src/fitness-goals/entities/fitness-goal.entity';
import { User } from '../src/users/entities/user.entity';

const PASSWORD = 'FitnessPass123';
const today = daysFromToday(0);
const yesterday = daysFromToday(-1);

describe('FitSync Version 2.0 (e2e): fitness management', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const expectError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, statusCode: status });
    expect(Array.isArray(res.body.errors)).toBe(true);
  };
  const log = (who: string, body: Record<string, unknown>) =>
    http.post('/api/v1/workout-logs').set(auth(who)).send({ workoutDate: today, sets: 3, repetitions: 10, durationMinutes: 15, ...body });
  const planCompletion = (planId: number, who = 'member', query = '') => http.get(`/api/v1/workout-plans/${planId}/completion${query}`).set(auth(who));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get(DataSource);

    const users = db.getRepository(User);
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const people: Array<[string, string, Role]> = [
      ['admin', 'Fitness Admin', Role.Admin],
      ['trainer', 'Fitness Trainer', Role.Trainer],
      ['trainer2', 'Second Trainer', Role.Trainer],
      ['member', 'Fitness Member', Role.Member],
      ['member2', 'Other Member', Role.Member],
      ['member3', 'Goal Member', Role.Member],
    ];
    const saved = await users.save(people.map(([key, fullName, role]) => users.create({ fullName, email: `${key}@fitness.test`, role, passwordHash, isActive: true })));
    people.forEach(([key], i) => (ids[key] = saved[i].userId));
    for (const [key] of people) {
      const res = await http.post('/api/v1/auth/login').send({ email: `${key}@fitness.test`, password: PASSWORD });
      tokens[key] = res.body.accessToken;
    }

    // Catalog, assignments (trainer -> member, trainer2 -> member2) and a 3-exercise plan.
    for (const [key, exerciseName, category] of [
      ['squat', 'Fitness Squat', 'Strength'],
      ['pushup', 'Fitness Push-up', 'Strength'],
      ['plank', 'Fitness Plank', 'Core'],
      ['run', 'Fitness Run', 'Cardio'],
    ]) {
      ids[key] = (await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName, category })).body.exerciseId;
    }
    ids.assignment = (await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member })).body.assignmentId;
    await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer2, memberId: ids.member2 });

    ids.plan = (await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.member, planName: 'Strength Basics' })).body.planId;
    for (const [key, exercise, targetSets, targetReps] of [
      ['peSquat', 'squat', 3, 12],
      ['pePushup', 'pushup', 3, 10],
      ['pePlank', 'plank', 2, 1],
    ] as const) {
      ids[key] = (await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids[exercise], targetSets, targetReps })).body.planExerciseId;
    }
    ids.plan2 = (await http.post('/api/v1/workout-plans').set(auth('trainer2')).send({ memberId: ids.member2, planName: 'Other Plan' })).body.planId;
    ids.pe2Squat = (await http.post('/api/v1/plan-exercises').set(auth('trainer2')).send({ planId: ids.plan2, exerciseId: ids.squat, targetSets: 3, targetReps: 5 })).body.planExerciseId;
  });

  afterAll(async () => {
    await app.close();
  });

  // =====================================================================
  describe('Workout plan completion tracking', () => {
    it('starts with every prescribed exercise pending', async () => {
      const res = await planCompletion(ids.plan);
      expect(res.status).toBe(200);
      expect(res.body.range).toMatchObject({ period: 'week', to: today, days: 7 });
      expect(res.body.summary).toEqual({
        prescribedExercises: 3,
        completedExercises: 0,
        partialExercises: 0,
        pendingExercises: 3,
        completionPercent: 0,
        linkedWorkouts: 0,
      });
      expect(res.body.exercises.map((e: { status: string }) => e.status)).toEqual(['pending', 'pending', 'pending']);
    });

    it('logs a workout directly from the plan (one request, one transaction)', async () => {
      const res = await log('member', { exerciseId: ids.squat, planExerciseId: ids.peSquat, sets: 3, repetitions: 12, durationMinutes: 20 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ exerciseId: ids.squat, memberId: ids.member, sets: 3, repetitions: 12 });
      expect(res.body.completion).toMatchObject({
        planId: ids.plan,
        planName: 'Strength Basics',
        planExerciseId: ids.peSquat,
        prescribed: { sets: 3, reps: 12 },
        actual: { sets: 3, repetitions: 12, durationMinutes: 20 },
        scorePercent: 100,
        status: 'completed',
      });
      ids.squatLog = res.body.logId;
      ids.squatCompletion = res.body.completion.completionId;
    });

    it('keeps the original POST /workout-logs response when no plan is given', async () => {
      const res = await log('member', { exerciseId: ids.run, sets: 1, repetitions: 0, durationMinutes: 30 });
      expect(res.status).toBe(201);
      expect(res.body.completion).toBeUndefined();
      ids.runLog = res.body.logId;
    });

    it('records partial completion when the actual work is below the prescription', async () => {
      const res = await log('member', { exerciseId: ids.pushup, planExerciseId: ids.pePushup, sets: 2, repetitions: 10 });
      expect(res.status).toBe(201);
      // min(1, 2/3) × min(1, 10/10) = 0.667
      expect(res.body.completion).toMatchObject({ status: 'partial', scorePercent: 66.7 });
      ids.pushupLog = res.body.logId;
    });

    it('summarises completed, partial and pending exercises and the completion percentage', async () => {
      const res = await planCompletion(ids.plan);
      expect(res.body.summary).toMatchObject({ completedExercises: 1, partialExercises: 1, pendingExercises: 1, linkedWorkouts: 2 });
      // (1 + 0.667 + 0) / 3 = 55.6 %
      expect(res.body.summary.completionPercent).toBe(55.6);
      const [squat, pushup, plank] = res.body.exercises;
      expect(squat).toMatchObject({ status: 'completed', prescribed: { sets: 3, reps: 12 }, best: { actual: { sets: 3, repetitions: 12, durationMinutes: 20 } } });
      expect(pushup).toMatchObject({ status: 'partial', scorePercent: 66.7 });
      expect(plank).toMatchObject({ status: 'pending', best: null, attempts: 0 });
    });

    it('rejects an unrelated exercise, another member’s plan and workouts before the plan', async () => {
      const wrong = await log('member', { exerciseId: ids.run, planExerciseId: ids.pePlank });
      expectError(wrong, 400);
      expect(wrong.body.errors.join(' ')).toMatch(/Fitness Plank/);
      expectError(await log('member', { exerciseId: ids.squat, planExerciseId: ids.pe2Squat }), 403);
      expectError(await log('member', { exerciseId: ids.plank, planExerciseId: ids.pePlank, workoutDate: yesterday }), 400);
      expectError(await log('member', { exerciseId: ids.plank, planExerciseId: 999999 }), 404);
      expectError(await log('member', { exerciseId: ids.plank, planExerciseId: 'abc' }), 400);
      // Nothing was saved by the rejected requests.
      expect((await planCompletion(ids.plan)).body.summary.linkedWorkouts).toBe(2);
    });

    it('links an existing workout once and refuses to count it twice', async () => {
      const plankLog = await log('member', { exerciseId: ids.plank, sets: 2, repetitions: 1 });
      const res = await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: plankLog.body.logId, planExerciseId: ids.pePlank });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'completed', logId: plankLog.body.logId });
      ids.plankLog = plankLog.body.logId;
      ids.plankCompletion = res.body.completionId;

      const again = await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: plankLog.body.logId, planExerciseId: ids.pePlank });
      expectError(again, 409);
      expect(again.body.message).toBe('Workout already counted.');
      // Already linked when it was created from the plan:
      expectError(await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: ids.squatLog, planExerciseId: ids.peSquat }), 409);
    });

    it('rejects linking someone else’s workout or an unrelated workout', async () => {
      const other = await log('member2', { exerciseId: ids.squat });
      expectError(await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: other.body.logId, planExerciseId: ids.peSquat }), 403);
      expectError(await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: ids.runLog, planExerciseId: ids.peSquat }), 400);
      expectError(await http.post('/api/v1/workout-completions').set(auth('trainer')).send({ logId: ids.runLog, planExerciseId: ids.peSquat }), 403);
      expectError(await http.post('/api/v1/workout-completions').set(auth('member')).send({ logId: ids.runLog }), 400);
    });

    it('counts repeated workouts for the same prescription only once', async () => {
      await log('member', { exerciseId: ids.squat, planExerciseId: ids.peSquat, sets: 1, repetitions: 5 });
      const res = await planCompletion(ids.plan);
      const squat = res.body.exercises[0];
      expect(squat).toMatchObject({ status: 'completed', attempts: 2, scorePercent: 100 });
      // 3 prescribed exercises: squat 1 + push-up 0.667 + plank 1 -> 88.9 %
      expect(res.body.summary.completionPercent).toBe(88.9);
    });

    it('recalculates when a linked workout log is edited', async () => {
      const upd = await http.patch(`/api/v1/workout-logs/${ids.pushupLog}`).set(auth('member')).send({ sets: 3 });
      expect(upd.status).toBe(200);
      expect(upd.body.completion).toBeUndefined(); // PATCH response shape unchanged
      const res = await planCompletion(ids.plan);
      expect(res.body.exercises[1]).toMatchObject({ status: 'completed', scorePercent: 100 });
      expect(res.body.summary.completionPercent).toBe(100);
    });

    it('stops counting a workout whose exercise is changed to an unrelated one', async () => {
      await http.patch(`/api/v1/workout-logs/${ids.pushupLog}`).set(auth('member')).send({ exerciseId: ids.run });
      const res = await planCompletion(ids.plan);
      expect(res.body.exercises[1]).toMatchObject({ status: 'pending' });
      const history = await http.get(`/api/v1/workout-completions?planId=${ids.plan}`).set(auth('member'));
      expect(history.body.some((c: { logId: number }) => c.logId === ids.pushupLog)).toBe(false);
    });

    it('recalculates when a linked workout log is deleted', async () => {
      expect((await http.delete(`/api/v1/workout-logs/${ids.plankLog}`).set(auth('member'))).status).toBe(204);
      const res = await planCompletion(ids.plan);
      expect(res.body.exercises[2]).toMatchObject({ status: 'pending', attempts: 0 });
      expect((await http.get(`/api/v1/workout-completions?planId=${ids.plan}`).set(auth('member'))).body.some((c: { completionId: number }) => c.completionId === ids.plankCompletion)).toBe(false);
    });

    it('lets the member stop counting a workout without deleting the log', async () => {
      const pl = await log('member', { exerciseId: ids.plank, planExerciseId: ids.pePlank, sets: 2, repetitions: 1 });
      const completionId = pl.body.completion.completionId;
      expectError(await http.delete(`/api/v1/workout-completions/${completionId}`).set(auth('member2')), 403);
      expectError(await http.delete(`/api/v1/workout-completions/${completionId}`).set(auth('trainer')), 403);
      expect((await http.delete(`/api/v1/workout-completions/${completionId}`).set(auth('member'))).status).toBe(204);
      expect((await http.get(`/api/v1/workout-logs/${pl.body.logId}`).set(auth('member'))).status).toBe(200);
      expectError(await http.delete(`/api/v1/workout-completions/${completionId}`).set(auth('member')), 404);
    });

    it('keeps history when the prescription changes or is removed from the plan', async () => {
      // Trainer raises the squat target: the earlier completion keeps the target in force at the time.
      await http.patch(`/api/v1/plan-exercises/${ids.peSquat}`).set(auth('trainer')).send({ targetReps: 15 });
      const res = await planCompletion(ids.plan);
      expect(res.body.exercises[0]).toMatchObject({ prescribed: { sets: 3, reps: 15 }, status: 'completed', best: { prescribedAtTheTime: { sets: 3, reps: 12 } } });

      // Removing the exercise keeps the history row with the snapshot.
      expect((await http.delete(`/api/v1/plan-exercises/${ids.pePlank}`).set(auth('trainer'))).status).toBe(204);
      const plankLog = await log('member', { exerciseId: ids.plank, sets: 2, repetitions: 1 });
      expect(plankLog.status).toBe(201);
      const history = await http.get(`/api/v1/workout-completions?planId=${ids.plan}`).set(auth('member'));
      expect(history.status).toBe(200);
      const squatRow = history.body.find((c: { completionId: number }) => c.completionId === ids.squatCompletion);
      expect(squatRow).toMatchObject({ prescribed: { sets: 3, reps: 12 }, planName: 'Strength Basics', status: 'completed' });
      expect((await planCompletion(ids.plan)).body.summary.prescribedExercises).toBe(2);
    });

    it('scopes completion history like workout logs, with pagination headers', async () => {
      const own = await http.get('/api/v1/workout-completions?limit=2&page=1').set(auth('member'));
      expect(own.status).toBe(200);
      expect(own.headers['x-total-count']).toBeDefined();
      expect(own.body.length).toBeLessThanOrEqual(2);
      expect(own.body.every((c: { memberId: number }) => c.memberId === ids.member)).toBe(true);

      expect((await http.get(`/api/v1/workout-completions?memberId=${ids.member}`).set(auth('trainer'))).status).toBe(200);
      expectError(await http.get(`/api/v1/workout-completions?memberId=${ids.member}`).set(auth('trainer2')), 403);
      expectError(await http.get(`/api/v1/workout-completions?memberId=${ids.member}`).set(auth('member2')), 403);
      expectError(await http.get('/api/v1/workout-completions'), 401);
      expectError(await http.get('/api/v1/workout-completions?from=2026-13-01').set(auth('member')), 400);
    });

    it('restricts plan completion to the plan’s member, its trainer and admins', async () => {
      expect((await planCompletion(ids.plan, 'trainer')).status).toBe(200);
      expect((await planCompletion(ids.plan, 'admin')).status).toBe(200);
      expectError(await planCompletion(ids.plan, 'trainer2'), 403);
      expectError(await planCompletion(ids.plan, 'member2'), 403);
      expectError(await planCompletion(999999), 404);
      expectError(await planCompletion(ids.plan, 'member', '?period=year'), 400);
      expect((await planCompletion(ids.plan, 'member', `?from=${daysFromToday(-29)}&to=${today}`)).body.range).toMatchObject({ period: 'custom', days: 30 });
    });

    it('reports null completion (not 0 %) for a plan without exercises', async () => {
      const empty = await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.member, planName: 'Empty Plan' });
      const res = await planCompletion(empty.body.planId);
      expect(res.body.summary).toMatchObject({ prescribedExercises: 0, completionPercent: null });
      await http.delete(`/api/v1/workout-plans/${empty.body.planId}`).set(auth('trainer'));
    });

    it('gives trainers adherence for assigned members only', async () => {
      const res = await http.get('/api/v1/workout-completions/adherence').set(auth('trainer'));
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(1);
      const row = res.body.members[0];
      expect(row.member.userId).toBe(ids.member);
      expect(row.plans.map((p: { planName: string }) => p.planName)).toEqual(['Strength Basics']);
      expect(row).toMatchObject({ prescribedExercises: 2, completedExercises: 1, pendingExercises: 1, completionPercent: 50 });
      expect(row.planWorkouts + row.otherWorkouts).toBe(row.workoutsInPeriod);
      expect(row.otherWorkouts).toBeGreaterThan(0); // the run and unlinked plank count as other workouts

      expectError(await http.get(`/api/v1/workout-completions/adherence?memberId=${ids.member}`).set(auth('trainer2')), 403);
      const self = await http.get('/api/v1/workout-completions/adherence').set(auth('member'));
      expect(self.body.members.map((m: { member: { userId: number } }) => m.member.userId)).toEqual([ids.member]);
      const all = await http.get('/api/v1/workout-completions/adherence').set(auth('admin'));
      expect(all.body.members.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps completion history when the plan is deleted', async () => {
      const temp = await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.member, planName: 'Temporary Plan' });
      const pe = await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: temp.body.planId, exerciseId: ids.run, targetSets: 1, targetReps: 1 });
      const done = await log('member', { exerciseId: ids.run, planExerciseId: pe.body.planExerciseId, sets: 1, repetitions: 1 });
      expect(done.body.completion.status).toBe('completed');
      expect((await http.delete(`/api/v1/workout-plans/${temp.body.planId}`).set(auth('trainer'))).status).toBe(204);
      const history = await http.get('/api/v1/workout-completions').set(auth('member'));
      const row = history.body.find((c: { completionId: number }) => c.completionId === done.body.completion.completionId);
      expect(row).toMatchObject({ planId: null, planExerciseId: null, planExerciseRemoved: true, planName: 'Temporary Plan', status: 'completed' });
    });
  });
  // =====================================================================
  describe('Fitness goal management', () => {
    const in13 = daysFromToday(13); // 14 days = 2 goal weeks
    const goal = (who: string, body: Record<string, unknown>) => http.post('/api/v1/fitness-goals').set(auth(who)).send(body);
    const weight = (who: string, recordDate: string, weightKg: number) => http.post('/api/v1/progress-records').set(auth(who)).send({ recordDate, weightKg });

    beforeAll(async () => {
      await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member3 });
    });

    it('creates a weight-loss goal using the latest recorded weight as the starting value', async () => {
      await weight('member3', yesterday, 80);
      const res = await goal('member3', { goalType: 'TargetWeight', goalName: 'Lose 4 kg', targetValue: 76, targetDate: daysFromToday(60) });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ goalType: 'TargetWeight', startingValue: 80, targetValue: 76, startDate: today, status: 'Active', memberId: ids.member3 });
      // The starting record is dated before the goal started: no measurement in the goal period yet.
      expect(res.body.progress).toMatchObject({ state: 'NoData', progressPercent: null, unit: 'kg', weight: { direction: 'loss', measurements: 0 } });
      ids.weightGoal = res.body.goalId;
    });

    it('calculates progress from new weight records (no double entry)', async () => {
      await weight('member3', today, 79);
      const res = await http.get(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3'));
      expect(res.status).toBe(200);
      expect(res.body.progress).toMatchObject({ state: 'InProgress', progressPercent: 25, currentValue: 79, weight: { changeKg: -1, remainingKg: 3 } });
    });

    it('requires a starting weight when none is recorded', async () => {
      const res = await goal('member2', { goalType: 'TargetWeight', goalName: 'Gain weight', targetValue: 63, targetDate: daysFromToday(60) });
      expectError(res, 400);
      expect(res.body.message).toBe('Starting weight required.');
    });

    it('handles weight-gain goals with an explicit starting weight', async () => {
      const res = await goal('member2', { goalType: 'TargetWeight', goalName: 'Gain 3 kg', startingValue: 60, targetValue: 63, targetDate: daysFromToday(90) });
      expect(res.status).toBe(201);
      expect(res.body.progress.weight).toMatchObject({ direction: 'gain', startingKg: 60, targetKg: 63 });
      await weight('member2', today, 61.5);
      expect((await http.get(`/api/v1/fitness-goals/${res.body.goalId}`).set(auth('member2'))).body.progress.progressPercent).toBe(50);
    });

    it('allows only one active goal per type', async () => {
      const res = await goal('member3', { goalType: 'TargetWeight', goalName: 'Second weight goal', targetValue: 70, targetDate: daysFromToday(60) });
      expectError(res, 409);
    });

    it('measures weekly workout frequency in distinct workout days', async () => {
      const res = await goal('member3', { goalType: 'WeeklyWorkouts', goalName: '3 workout days a week', targetValue: 3, targetDate: in13 });
      expect(res.status).toBe(201);
      expect(res.body.progress).toMatchObject({ state: 'OnTrack', progressPercent: 0, currentValue: 0, unit: 'workout days' });
      expect(res.body.progress.weekly).toMatchObject({ totalWeeks: 2, weeksMet: 0 });
      ids.frequencyGoal = res.body.goalId;

      // Two exercises on the same day = one workout day.
      await log('member3', { exerciseId: ids.squat, durationMinutes: 25 });
      await log('member3', { exerciseId: ids.run, durationMinutes: 35 });
      const after = await http.get(`/api/v1/fitness-goals/${ids.frequencyGoal}`).set(auth('member3'));
      expect(after.body.progress.weekly.currentWeek).toMatchObject({ index: 1, from: today, value: 1, target: 3, met: false });
      expect(after.body.progress.weekly.weeks).toHaveLength(2);
    });

    it('measures weekly workout duration in minutes', async () => {
      const res = await goal('member3', { goalType: 'WeeklyMinutes', goalName: '60 minutes a week', targetValue: 60, targetDate: in13 });
      expect(res.status).toBe(201);
      expect(res.body.progress.weekly.currentWeek).toMatchObject({ value: 60, met: true, percent: 100 });
      expect(res.body.progress).toMatchObject({ progressPercent: 50, state: 'OnTrack', unit: 'minutes' });
      ids.minutesGoal = res.body.goalId;
    });

    it('validates goal values and dates', async () => {
      const base = { goalName: 'Invalid goal', targetDate: in13 };
      const cases: Array<Record<string, unknown>> = [
        { ...base, goalType: 'WeeklyWorkouts', targetValue: 8 },
        { ...base, goalType: 'WeeklyWorkouts', targetValue: 2.5 },
        { ...base, goalType: 'WeeklyMinutes', targetValue: 5 },
        { ...base, goalType: 'WeeklyMinutes', targetValue: 100, targetDate: daysFromToday(10) }, // not whole weeks
        { ...base, goalType: 'WeeklyMinutes', targetValue: 100, startingValue: 50 },
        { ...base, goalType: 'TargetWeight', startingValue: 70, targetValue: 70, targetDate: daysFromToday(30) },
        { ...base, goalType: 'TargetWeight', startingValue: 70, targetValue: 500, targetDate: daysFromToday(30) },
        { ...base, goalType: 'TargetWeight', startingValue: 70, targetValue: 65, startDate: daysFromToday(-10), targetDate: yesterday },
        { ...base, goalType: 'TargetWeight', startingValue: 70, targetValue: 65, startDate: daysFromToday(120), targetDate: daysFromToday(150) },
        { ...base, goalType: 'TargetWeight', startingValue: 70, targetValue: 65, targetDate: daysFromToday(800) },
        { ...base, goalType: 'Strength', targetValue: 3 },
        { ...base, goalType: 'WeeklyMinutes', targetValue: 100, goalName: 'x' },
        { ...base, goalType: 'WeeklyMinutes', targetValue: 100, targetDate: '2026-02-30' },
      ];
      for (const body of cases) expectError(await goal('member2', body), 400);
    });

    it('enforces roles and ownership', async () => {
      expectError(await goal('trainer', { goalType: 'WeeklyWorkouts', goalName: 'Trainer goal', targetValue: 3, targetDate: in13 }), 403);
      expectError(await http.get(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member2')), 403);
      expectError(await http.get(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('trainer2')), 403);
      expectError(await http.get(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('admin')), 403);
      expectError(await http.get('/api/v1/fitness-goals').set(auth('admin')), 403);
      expectError(await http.get(`/api/v1/fitness-goals?memberId=${ids.member3}`).set(auth('trainer2')), 403);
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member2')).send({ goalName: 'Hijack' }), 403);
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('trainer')).send({ goalName: 'Hijack' }), 403);
      expectError(await http.get('/api/v1/fitness-goals/999999').set(auth('member3')), 404);
      expectError(await http.get('/api/v1/fitness-goals'), 401);
    });

    it('lets the assigned trainer monitor member goals with filters and pagination', async () => {
      const res = await http.get(`/api/v1/fitness-goals?memberId=${ids.member3}&limit=2`).set(auth('trainer'));
      expect(res.status).toBe(200);
      expect(res.headers['x-total-count']).toBe('3');
      expect(res.body).toHaveLength(2);
      expect(res.body[0].member).toEqual({ userId: ids.member3, fullName: 'Goal Member' });
      expect(res.body[0].progress.weekly?.weeks).toBeUndefined(); // list stays compact
      const weekly = await http.get(`/api/v1/fitness-goals?memberId=${ids.member3}&goalType=WeeklyWorkouts`).set(auth('trainer'));
      expect(weekly.body.map((g: { goalId: number }) => g.goalId)).toEqual([ids.frequencyGoal]);
      expectError(await http.get('/api/v1/fitness-goals?status=Done').set(auth('member3')), 400);
    });

    it('updates an active goal and re-validates it', async () => {
      const res = await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3')).send({ goalName: 'Lose 5 kg', targetValue: 75 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ goalName: 'Lose 5 kg', targetValue: 75 });
      expect(res.body.progress.progressPercent).toBe(20); // 1 of 5 kg
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3')).send({ targetValue: 80 }), 400);
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.frequencyGoal}`).set(auth('member3')).send({ startingValue: 2 }), 400);
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3')).send({ goalType: 'WeeklyMinutes' }), 400);
    });

    it('completes a weight goal automatically when a record reaches the target', async () => {
      await weight('member3', today, 74.9);
      const res = await http.get(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3'));
      expect(res.body).toMatchObject({ status: 'Completed', progress: { state: 'Achieved', achieved: true, achievedOn: today, progressPercent: 100 } });
      expect(res.body.closedAt).not.toBeNull();
      const closed = await http.patch(`/api/v1/fitness-goals/${ids.weightGoal}`).set(auth('member3')).send({ goalName: 'Too late' });
      expectError(closed, 409);
      // With the weight goal completed, a new one can be created.
      expect((await goal('member3', { goalType: 'TargetWeight', goalName: 'Next step', targetValue: 72, targetDate: daysFromToday(90) })).body.startingValue).toBe(74.9);
    });

    it('cancels a goal and keeps it in the history', async () => {
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.minutesGoal}`).set(auth('member3')).send({ status: 'Cancelled', goalName: 'Mixed' }), 400);
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.minutesGoal}`).set(auth('member3')).send({ status: 'Completed' }), 400);
      const res = await http.patch(`/api/v1/fitness-goals/${ids.minutesGoal}`).set(auth('member3')).send({ status: 'Cancelled' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'Cancelled', progress: { state: 'Cancelled' } });
      expectError(await http.patch(`/api/v1/fitness-goals/${ids.minutesGoal}`).set(auth('member3')).send({ status: 'Cancelled' }), 409);
      const cancelled = await http.get('/api/v1/fitness-goals?status=Cancelled').set(auth('member3'));
      expect(cancelled.body.map((g: { goalId: number }) => g.goalId)).toEqual([ids.minutesGoal]);
    });

    it('closes a goal as Missed once its target date has passed', async () => {
      // Created directly: the API never accepts a target date in the past.
      const repo = db.getRepository(FitnessGoal);
      const old = await repo.save(
        repo.create({ memberId: ids.member2, goalType: 'WeeklyWorkouts', goalName: 'Old habit', startingValue: null, targetValue: 4, startDate: daysFromToday(-21), targetDate: daysFromToday(-8), status: 'Active' }),
      );
      const res = await http.get(`/api/v1/fitness-goals/${old.goalId}`).set(auth('member2'));
      expect(res.body).toMatchObject({ status: 'Missed', progress: { state: 'Missed', progressPercent: 0 } });
      expect((await http.get('/api/v1/fitness-goals?status=Active').set(auth('member2'))).body.some((g: { goalId: number }) => g.goalId === old.goalId)).toBe(false);
    });
  });
  // =====================================================================
  describe('Trainer feedback', () => {
    const give = (who: string, body: Record<string, unknown>) => http.post('/api/v1/trainer-feedback').set(auth(who)).send(body);
    const list = (who: string, query = '') => http.get(`/api/v1/trainer-feedback${query}`).set(auth(who));

    it('lets an assigned trainer give feedback, optionally about a goal or plan', async () => {
      const general = await give('trainer', { memberId: ids.member3, feedbackMessage: 'Great consistency this week.' });
      expect(general.status).toBe(201);
      expect(general.body).toMatchObject({
        trainerId: ids.trainer,
        memberId: ids.member3,
        feedbackType: 'General',
        feedbackMessage: 'Great consistency this week.',
        relatedGoal: null,
        relatedPlan: null,
        isRead: false,
        readAt: null,
        edited: false,
        trainer: { userId: ids.trainer, fullName: 'Fitness Trainer' },
      });
      ids.fbGeneral = general.body.feedbackId;
      // Timestamps are real UTC instants (not local wall-clock time read as UTC).
      expect(Math.abs(Date.parse(general.body.createdAt) - Date.now())).toBeLessThan(120_000);

      const aboutGoal = await give('trainer', { memberId: ids.member3, feedbackType: 'Encouragement', feedbackMessage: 'Two more workout days to hit your weekly goal!', relatedGoalId: ids.frequencyGoal });
      expect(aboutGoal.status).toBe(201);
      expect(aboutGoal.body.relatedGoal).toMatchObject({ goalId: ids.frequencyGoal, goalName: '3 workout days a week', goalType: 'WeeklyWorkouts' });
      ids.fbGoal = aboutGoal.body.feedbackId;

      const aboutPlan = await give('trainer', { memberId: ids.member, feedbackType: 'Guidance', feedbackMessage: 'Keep reps < 12 on squats and rest > 60 s.', relatedPlanId: ids.plan });
      expect(aboutPlan.status).toBe(201);
      expect(aboutPlan.body).toMatchObject({ relatedPlan: { planId: ids.plan, planName: 'Strength Basics' }, feedbackMessage: 'Keep reps < 12 on squats and rest > 60 s.' });
    });

    it('validates related goals and plans', async () => {
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'Both', relatedGoalId: ids.frequencyGoal, relatedPlanId: ids.plan }), 400);
      expectError(await give('trainer', { memberId: ids.member, feedbackMessage: 'Wrong goal', relatedGoalId: ids.frequencyGoal }), 400);
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'Wrong plan', relatedPlanId: ids.plan }), 400);
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'Missing goal', relatedGoalId: 999999 }), 404);
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'Missing plan', relatedPlanId: 999999 }), 404);
    });

    it('restricts writing to assigned trainers', async () => {
      expectError(await give('trainer2', { memberId: ids.member3, feedbackMessage: 'Not my member' }), 403);
      expectError(await give('member', { memberId: ids.member3, feedbackMessage: 'Members cannot write' }), 403);
      expectError(await give('admin', { memberId: ids.member3, feedbackMessage: 'Admins cannot write' }), 403);
      expectError(await give('trainer', { memberId: ids.trainer2, feedbackMessage: 'Not a member' }), 404);
      expectError(await give('trainer', { memberId: 999999, feedbackMessage: 'Nobody' }), 404);
      expectError(await http.post('/api/v1/trainer-feedback').send({ memberId: ids.member3, feedbackMessage: 'No token' }), 401);
    });

    it('validates and sanitizes the message', async () => {
      for (const feedbackMessage of ['', '   ', '<b></b>', 'x'.repeat(1001), 42]) {
        expectError(await give('trainer', { memberId: ids.member3, feedbackMessage }), 400);
      }
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'Fine', feedbackType: 'Rant' }), 400);
      expectError(await give('trainer', { memberId: ids.member3 }), 400);
      const res = await give('trainer', { memberId: ids.member3, feedbackType: 'Concern', feedbackMessage: '  Watch your form <script>alert(1)</script>\r\n\r\n\r\n<img src=x onerror=alert(2)>on deadlifts.  ' });
      expect(res.status).toBe(201);
      expect(res.body.feedbackMessage).toBe('Watch your form alert(1)\n\non deadlifts.');
      ids.fbConcern = res.body.feedbackId;
    });

    it('shows members only their own feedback, with an unread count', async () => {
      const res = await list('member3');
      expect(res.status).toBe(200);
      expect(res.headers['x-unread-count']).toBe('3');
      expect(res.headers['x-total-count']).toBe('3');
      expect(res.body.every((f: { memberId: number }) => f.memberId === ids.member3)).toBe(true);
      expect(res.body[0].feedbackId).toBe(ids.fbConcern); // newest first

      const other = await list('member');
      expect(other.body.map((f: { memberId: number }) => f.memberId)).toEqual([ids.member]);
      expectError(await list('member', `?memberId=${ids.member3}`), 403);
      expectError(await http.get(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('member')), 403);
      expect((await list('member3', `?relatedGoalId=${ids.frequencyGoal}`)).body.map((f: { feedbackId: number }) => f.feedbackId)).toEqual([ids.fbGoal]);
    });

    it('lets the member mark feedback as read (idempotent)', async () => {
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}/read`).set(auth('member')), 403);
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}/read`).set(auth('trainer')), 403);
      const first = await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}/read`).set(auth('member3'));
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ isRead: true, edited: false }); // a read receipt is not an edit
      expect(first.body.updatedAt).toBe(first.body.createdAt);
      expect(first.body.readAt).not.toBeNull();
      const again = await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}/read`).set(auth('member3'));
      expect(again.body.readAt).toBe(first.body.readAt);

      const unread = await list('member3', '?unread=true');
      expect(unread.headers['x-unread-count']).toBe('2');
      expect(unread.body.map((f: { feedbackId: number }) => f.feedbackId)).not.toContain(ids.fbGeneral);
      expect((await list('member3', '?unread=false')).body.map((f: { feedbackId: number }) => f.feedbackId)).toEqual([ids.fbGeneral]);
      expectError(await list('member3', '?unread=maybe'), 400);
      expectError(await http.patch('/api/v1/trainer-feedback/999999/read').set(auth('member3')), 404);
    });

    it('lets the author edit; a changed message becomes unread again', async () => {
      const typeOnly = await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')).send({ feedbackType: 'Encouragement' });
      expect(typeOnly.status).toBe(200);
      expect(typeOnly.body).toMatchObject({ feedbackType: 'Encouragement', isRead: true });

      const edited = await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')).send({ feedbackMessage: 'Great consistency — keep it up!', relatedGoalId: ids.frequencyGoal });
      expect(edited.body).toMatchObject({ feedbackMessage: 'Great consistency — keep it up!', isRead: false, readAt: null, relatedGoalId: ids.frequencyGoal });
      const cleared = await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')).send({ relatedGoalId: null });
      expect(cleared.body.relatedGoal).toBeNull();

      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer2')).send({ feedbackMessage: 'Not mine' }), 403);
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('member3')).send({ feedbackMessage: 'Member edit' }), 403);
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')).send({ feedbackMessage: ' ' }), 400);
    });

    it('lets the author delete their feedback', async () => {
      const temp = await give('trainer', { memberId: ids.member3, feedbackMessage: 'Sent by mistake' });
      expectError(await http.delete(`/api/v1/trainer-feedback/${temp.body.feedbackId}`).set(auth('trainer2')), 403);
      expectError(await http.delete(`/api/v1/trainer-feedback/${temp.body.feedbackId}`).set(auth('member3')), 403);
      expect((await http.delete(`/api/v1/trainer-feedback/${temp.body.feedbackId}`).set(auth('trainer'))).status).toBe(204);
      expectError(await http.get(`/api/v1/trainer-feedback/${temp.body.feedbackId}`).set(auth('trainer')), 404);
    });

    it('keeps message content away from administrators', async () => {
      expectError(await list('admin'), 403);
      expectError(await http.get(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('admin')), 403);
    });

    it('preserves feedback history after the member is reassigned to another trainer', async () => {
      const assignment = await http.get(`/api/v1/trainer-assignments?memberId=${ids.member3}&trainerId=${ids.trainer}`).set(auth('admin'));
      expect(assignment.body).toHaveLength(1);
      const moved = await http.put(`/api/v1/trainer-assignments/${assignment.body[0].assignmentId}`).set(auth('admin')).send({ trainerId: ids.trainer2, memberId: ids.member3 });
      expect(moved.status).toBe(200);

      // The member keeps all feedback.
      expect((await list('member3')).headers['x-total-count']).toBe('3');
      // The former trainer keeps read access to what they wrote, but can no longer change it or write more.
      const history = await list('trainer', `?memberId=${ids.member3}`);
      expect(history.status).toBe(200);
      expect(history.body).toHaveLength(3);
      expect((await http.get(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer'))).status).toBe(200);
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')).send({ feedbackMessage: 'After reassignment' }), 403);
      expectError(await http.delete(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer')), 403);
      expectError(await give('trainer', { memberId: ids.member3, feedbackMessage: 'No longer assigned' }), 403);
      // The new trainer sees the history for continuity but cannot edit the old trainer's notes.
      const newTrainer = await list('trainer2', `?memberId=${ids.member3}`);
      expect(newTrainer.body).toHaveLength(3);
      expectError(await http.patch(`/api/v1/trainer-feedback/${ids.fbGeneral}`).set(auth('trainer2')).send({ feedbackMessage: 'Rewrite' }), 403);
      const fresh = await give('trainer2', { memberId: ids.member3, feedbackMessage: 'Welcome — I am your new trainer.' });
      expect(fresh.status).toBe(201);
      // The former trainer does not see the new trainer's feedback.
      expect((await list('trainer', `?memberId=${ids.member3}`)).body.some((f: { feedbackId: number }) => f.feedbackId === fresh.body.feedbackId)).toBe(false);
      // A trainer who never worked with the member gets 403.
      expectError(await list('trainer2', `?memberId=${ids.member}`), 403);
    });
  });
  // =====================================================================
  describe('Dashboards (Version 2.0 additions)', () => {
    it('adds plan completion, active goals and recent feedback to the member dashboard', async () => {
      const res = await http.get('/api/v1/dashboard/member').set(auth('member3'));
      expect(res.status).toBe(200);
      // Original fields are unchanged.
      expect(res.body).toHaveProperty('summary.totalWorkouts');
      expect(res.body).toHaveProperty('activity');
      expect(res.body.fitness.planCompletion).toMatchObject({ completionPercent: null, prescribedExercises: 0 });
      expect(res.body.fitness.activeGoals.map((g: { goalName: string }) => g.goalName)).toEqual(expect.arrayContaining(['3 workout days a week', 'Next step']));
      expect(res.body.fitness.feedback.unread).toBeGreaterThan(0);
      expect(res.body.fitness.feedback.recent.length).toBeGreaterThan(0);

      const withPlan = await http.get('/api/v1/dashboard/member').set(auth('member'));
      expect(withPlan.body.fitness.planCompletion.plans.map((p: { planName: string }) => p.planName)).toEqual(['Strength Basics']);
    });

    it('lists members requiring attention with the reasons on the trainer dashboard', async () => {
      const res = await http.get('/api/v1/dashboard/trainer').set(auth('trainer2'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary.assignedMembers'); // original field
      expect(res.body.fitness.attentionCriteria).toHaveLength(4);
      const member2 = res.body.fitness.members.find((m: { member: { userId: number } }) => m.member.userId === ids.member2);
      // member2: plan from trainer2 with nothing completed, and a goal missed in the last 30 days.
      expect(member2.attentionReasons).toEqual(expect.arrayContaining(['Plan completion 0% in the last 7 days (below 50%)', 'Goal missed: Old habit']));
      expect(res.body.fitness.summary.membersRequiringAttention).toBeGreaterThanOrEqual(1);
      expect(res.body.fitness.recentFeedback[0].feedbackMessage).toBe('Welcome — I am your new trainer.');
    });

    it('shows administrators aggregates only, without names or messages', async () => {
      const res = await http.get('/api/v1/dashboard/admin').set(auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users.total'); // original field
      const { completion, goals, feedback } = res.body.fitness;
      expect(completion.membersWithPlans).toBeGreaterThanOrEqual(2);
      expect(goals.byStatus).toMatchObject({ Completed: 1, Missed: 1, Cancelled: 1 });
      expect(goals.achievementRatePercent).toBe(50);
      expect(feedback.total).toBeGreaterThanOrEqual(5);
      expect(feedback.byType.map((t: { feedbackType: string }) => t.feedbackType)).toEqual(['General', 'Encouragement', 'Guidance', 'Concern']);
      const text = JSON.stringify(res.body.fitness);
      for (const secret of ['Welcome — I am your new trainer.', 'Great consistency', '3 workout days a week', 'Goal Member', 'Fitness Member']) {
        expect(text).not.toContain(secret);
      }
    });
  });
  // =====================================================================
  describe('Reports (Version 2.0 sections)', () => {
    it('adds plan completion, goals and feedback counts to the member report without changing the original fields', async () => {
      const res = await http.get('/api/v1/reports/member?period=week').set(auth('member'));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.summary).sort()).toEqual(
        ['averageMinutesPerWorkoutDay', 'averageWorkoutsPerWeek', 'consistencyPercent', 'distinctWorkoutDays', 'longestStreakDays', 'totalDurationMinutes', 'totalRepetitions', 'totalSets', 'totalWorkouts'].sort(),
      );
      expect(res.body.fitness.planCompletion).toMatchObject({ prescribedExercises: 2, plans: [{ planName: 'Strength Basics', trainerName: 'Fitness Trainer' }] });
      expect(res.body.fitness.feedback).toEqual({ receivedInPeriod: 1, unreadNow: 1 });
    });

    it('exports the new sections to CSV with formula-injection protection', async () => {
      await http.post('/api/v1/fitness-goals').set(auth('member')).send({ goalType: 'WeeklyMinutes', goalName: '=HYPERLINK("http://evil.example","x")', targetValue: 90, targetDate: daysFromToday(13) });
      const res = await http.get('/api/v1/reports/member?period=week&format=csv').set(auth('member'));
      expect(res.status).toBe(200);
      const csv = res.text;
      for (const label of ['"Workout plan completion"', '"Plan completion (%)"', '"Plan completion by plan"', '"Fitness goals (progress on the generation date)"', '"Trainer feedback (counts only)"', '"Weekly minutes"']) {
        expect(csv).toContain(label);
      }
      expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
      expect(csv).not.toContain('Keep reps < 12'); // feedback messages are never exported
      expect(csv).not.toMatch(/completionPercent|prescribedExercises|receivedInPeriod/);
    });

    it('adds per-member completion, goals and feedback counts to the trainer report', async () => {
      const res = await http.get('/api/v1/reports/trainer?period=week').set(auth('trainer'));
      expect(res.status).toBe(200);
      const row = res.body.fitness.members.find((m: { member: { userId: number } }) => m.member.userId === ids.member);
      expect(row).toMatchObject({ prescribedExercises: 2, feedbackGiven: 1 });
      const csv = (await http.get('/api/v1/reports/trainer?period=week&format=csv').set(auth('trainer'))).text;
      expect(csv).toContain('"Plan completion and goals by member"');
      expect(csv).toContain('"Fitness management summary"');
      // The single-member report keeps the trainer restriction.
      expect((await http.get(`/api/v1/reports/trainer/members/${ids.member}?period=week`).set(auth('trainer'))).body.fitness.planCompletion.prescribedExercises).toBe(2);
      expectError(await http.get(`/api/v1/reports/trainer/members/${ids.member}?period=week`).set(auth('trainer2')), 403);
    });

    it('gives administrators aggregates only (no feedback content or goal names)', async () => {
      const res = await http.get('/api/v1/reports/admin?period=month').set(auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body.fitness.feedback.total).toBeGreaterThanOrEqual(5);
      expect(res.body.fitness.goals.total).toBeGreaterThanOrEqual(7);
      const csv = (await http.get('/api/v1/reports/admin?period=month&format=csv').set(auth('admin'))).text;
      expect(csv).toContain('"Trainer feedback in period (counts only, no message content)"');
      expect(csv).toContain('"Goals by type"');
      for (const secret of ['Welcome — I am your new trainer.', 'Great consistency', 'Keep reps', '3 workout days a week', 'HYPERLINK']) {
        expect(csv).not.toContain(secret);
        expect(JSON.stringify(res.body.fitness)).not.toContain(secret);
      }
    });
  });
});
