/**
 * Final QA defect corrections — e2e regression tests (fitsync_test_db only).
 *   H1  plan completion counts only the plan member's own workouts; a plan
 *       with completion history cannot be moved to another member
 *   L5  a former trainer no longer sees the member's plans or completion data
 *   M1  goal status after qualifying records are edited or deleted
 *   L1  oversized request body -> 413 in the standard error format
 *   L2  completion averages use unrounded scores
 *   L3  "never logged" vs "inactive recently" in the attention list
 *   L4  future workout / progress dates rejected (Asia/Manila calendar)
 *   L6  literal % and _ in search text
 * Uses its own *@qafix.test accounts.
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
import { User } from '../src/users/entities/user.entity';

const PASSWORD = 'QaFixPass123';
const today = daysFromToday(0);

describe('FitSync final QA fixes (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const expectError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, statusCode: status });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get(DataSource);

    const users = db.getRepository(User);
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const people: Array<[string, Role, string]> = [
      ['admin', Role.Admin, 'QA Admin'],
      ['trainer', Role.Trainer, 'QA Trainer'],
      ['trainer2', Role.Trainer, 'QA Trainer Two'],
      ['memberA', Role.Member, 'QA Member A'],
      ['memberB', Role.Member, 'QA Member B'],
      ['memberC', Role.Member, 'QA Member C'],
      ['percent', Role.Member, 'Promo 50% Member'],
      ['underscore', Role.Member, 'Under_score Member'],
    ];
    const saved = await users.save(people.map(([key, role, fullName]) => users.create({ fullName, email: `${key.toLowerCase()}@qafix.test`, role, passwordHash, isActive: true })));
    people.forEach(([key], i) => (ids[key] = saved[i].userId));
    for (const [key] of people) {
      tokens[key] = (await http.post('/api/v1/auth/login').send({ email: `${key.toLowerCase()}@qafix.test`, password: PASSWORD })).body.accessToken;
    }
    ids.squat = (await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'QA Squat', category: 'Strength' })).body.exerciseId;
    ids.plank = (await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'QA Plank', category: 'Core' })).body.exerciseId;
    for (const m of ['memberA', 'memberB', 'memberC']) {
      const a = await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids[m] });
      ids[`assign_${m}`] = a.body.assignmentId;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // =====================================================================
  describe('H1 — completion history stays with the member who did the workouts', () => {
    it('sets up a plan for member A with one counted workout (2 of 3 sets)', async () => {
      ids.plan = (await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.memberA, planName: 'QA Plan' })).body.planId;
      ids.pe = (await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3, targetReps: 10 })).body.planExerciseId;
      const log = await http.post('/api/v1/workout-logs').set(auth('memberA')).send({ exerciseId: ids.squat, workoutDate: today, sets: 2, repetitions: 10, durationMinutes: 10, planExerciseId: ids.pe });
      expect(log.status).toBe(201);
      ids.logA = log.body.logId;
      const c = await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('memberA'));
      expect(c.body.summary).toMatchObject({ completionPercent: 66.7, linkedWorkouts: 1 });
    });

    it('refuses to move a plan with completion history to another member (409)', async () => {
      const res = await http.put(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer')).send({ memberId: ids.memberB, planName: 'QA Plan moved' });
      expectError(res, 409);
      expect(res.body.message).toBe('Plan member cannot change.');
      const plan = await http.get(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer'));
      expect(plan.body.memberId).toBe(ids.memberA);
      // member B sees nothing of member A's plan
      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('memberB')), 403);
    });

    it('still allows renaming the plan, and moving a plan without completions', async () => {
      const rename = await http.put(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer')).send({ memberId: ids.memberA, planName: 'QA Plan renamed' });
      expect(rename.status).toBe(200);
      const empty = (await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.memberA, planName: 'Empty plan' })).body.planId;
      const move = await http.put(`/api/v1/workout-plans/${empty}`).set(auth('trainer')).send({ memberId: ids.memberB, planName: 'Empty plan' });
      expect(move.status).toBe(200);
      expect(move.body.memberId).toBe(ids.memberB);
    });

    it('never counts or shows another member\'s workouts even if legacy data links them', async () => {
      // Simulate data created before the fix: move the plan directly in the database.
      await db.query('UPDATE WorkoutPlans SET MemberID = ? WHERE PlanID = ?', [ids.memberB, ids.plan]);
      const c = await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('memberB'));
      expect(c.status).toBe(200);
      expect(c.body.summary).toMatchObject({ completionPercent: 0, linkedWorkouts: 0, pendingExercises: 1 });
      expect(c.body.exercises[0].best).toBeNull();
      expect(JSON.stringify(c.body)).not.toContain(`"logId":${ids.logA}`);
      const dash = await http.get('/api/v1/dashboard/member').set(auth('memberB'));
      expect(dash.body.fitness.planCompletion.completionPercent).toBe(0);
      const report = await http.get('/api/v1/reports/member?period=week').set(auth('memberB'));
      expect(report.body.fitness.planCompletion).toMatchObject({ completionPercent: 0, planWorkouts: 0 });
      const adherence = await http.get(`/api/v1/workout-completions/adherence?memberId=${ids.memberB}`).set(auth('trainer'));
      expect(adherence.body.members[0].completionPercent).toBe(0);
      const history = await http.get(`/api/v1/workout-completions?planId=${ids.plan}`).set(auth('memberB'));
      expect(history.body).toEqual([]);
      // Member A keeps their own workout and its completion record (history is not transferred or deleted).
      const own = await http.get('/api/v1/workout-completions').set(auth('memberA'));
      expect(own.body.map((x: { logId: number }) => x.logId)).toContain(ids.logA);
      await db.query('UPDATE WorkoutPlans SET MemberID = ? WHERE PlanID = ?', [ids.memberA, ids.plan]);
    });
  });

  // =====================================================================
  describe('L2 — averages from unrounded scores', () => {
    it('shows 33.3 % (not 33.4 %) for 2/3 of one exercise plus one pending exercise', async () => {
      await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.plank, targetSets: 1, targetDurationMinutes: 20 });
      const c = await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('memberA'));
      expect(c.body.summary.completionPercent).toBe(33.3);
      const dash = await http.get('/api/v1/dashboard/member').set(auth('memberA'));
      expect(dash.body.fitness.planCompletion.completionPercent).toBe(33.3);
    });
  });

  // =====================================================================
  describe('L3 — never logged vs inactive recently', () => {
    it('labels the reasons correctly and reports the most recent workout ever', async () => {
      await http.post('/api/v1/workout-logs').set(auth('memberB')).send({ exerciseId: ids.squat, workoutDate: daysFromToday(-9), sets: 1, repetitions: 5, durationMinutes: 5 });
      const res = await http.get('/api/v1/dashboard/trainer').set(auth('trainer'));
      const row = (id: number) => res.body.fitness.members.find((m: { member: { userId: number } }) => m.member.userId === id);
      expect(row(ids.memberB).attentionReasons).toContain('No workout logged in the last 7 days');
      expect(row(ids.memberB).attentionReasons).not.toContain('No workouts logged yet');
      expect(row(ids.memberB).lastWorkoutDate).toBe(daysFromToday(-9));
      expect(row(ids.memberC).attentionReasons).toContain('No workouts logged yet');
      expect(row(ids.memberC).lastWorkoutDate).toBeNull();
      const adherence = await http.get(`/api/v1/workout-completions/adherence?memberId=${ids.memberB}`).set(auth('trainer'));
      expect(adherence.body.members[0]).toMatchObject({ lastWorkoutDate: daysFromToday(-9), workoutsInPeriod: 0 });
    });
  });

  // =====================================================================
  describe('M1 — goal status after qualifying records change', () => {
    it('keeps a Completed weekly goal achieved after its workout is deleted, and flags it', async () => {
      const goal = await http.post('/api/v1/fitness-goals').set(auth('memberC')).send({ goalType: 'WeeklyMinutes', goalName: 'One week of minutes', targetValue: 30, startDate: daysFromToday(-6), targetDate: today });
      expect(goal.status).toBe(201);
      const log = await http.post('/api/v1/workout-logs').set(auth('memberC')).send({ exerciseId: ids.squat, workoutDate: today, sets: 1, repetitions: 1, durationMinutes: 45 });
      const done = await http.get(`/api/v1/fitness-goals/${goal.body.goalId}`).set(auth('memberC'));
      expect(done.body).toMatchObject({ status: 'Completed', progress: { state: 'Achieved', progressPercent: 100, evidenceChanged: false } });
      await http.delete(`/api/v1/workout-logs/${log.body.logId}`).set(auth('memberC'));
      const after = await http.get(`/api/v1/fitness-goals/${goal.body.goalId}`).set(auth('memberC'));
      expect(after.body).toMatchObject({ status: 'Completed', progress: { state: 'Achieved', progressPercent: 100, evidenceChanged: true, liveProgressPercent: 0 } });
    });

    it('keeps a Completed weight goal achieved after its measurement is deleted', async () => {
      await http.post('/api/v1/progress-records').set(auth('memberA')).send({ recordDate: daysFromToday(-3), weightKg: 70 });
      const goal = await http.post('/api/v1/fitness-goals').set(auth('memberA')).send({ goalType: 'TargetWeight', goalName: 'Down to 69', targetValue: 69, targetDate: daysFromToday(20) });
      const rec = await http.post('/api/v1/progress-records').set(auth('memberA')).send({ recordDate: today, weightKg: 68.5 });
      expect((await http.get(`/api/v1/fitness-goals/${goal.body.goalId}`).set(auth('memberA'))).body.status).toBe('Completed');
      await http.delete(`/api/v1/progress-records/${rec.body.progressId}`).set(auth('memberA'));
      const after = await http.get(`/api/v1/fitness-goals/${goal.body.goalId}`).set(auth('memberA'));
      expect(after.body).toMatchObject({ status: 'Completed', progress: { state: 'Achieved', progressPercent: 100, achievedOn: today, evidenceChanged: true } });
      // Closed goals still cannot be edited.
      expectError(await http.patch(`/api/v1/fitness-goals/${goal.body.goalId}`).set(auth('memberA')).send({ goalName: 'Changed' }), 409);
    });

    it('turns a Missed goal into Completed when late-logged records inside its period reach the target', async () => {
      const start = daysFromToday(-20);
      const end = daysFromToday(-14); // one finished goal week
      await db.query(
        "INSERT INTO FitnessGoals (MemberID, GoalType, GoalName, StartingValue, TargetValue, StartDate, TargetDate, Status, ClosedAt, CreatedAt, UpdatedAt) VALUES (?, 'WeeklyWorkouts', 'Late logger', NULL, 2, ?, ?, 'Missed', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())",
        [ids.memberB, start, end],
      );
      const [{ id }] = await db.query('SELECT MAX(GoalID) AS id FROM FitnessGoals WHERE MemberID = ?', [ids.memberB]);
      const missed = await http.get(`/api/v1/fitness-goals/${id}`).set(auth('memberB'));
      expect(missed.body).toMatchObject({ status: 'Missed', progress: { state: 'Missed' } });
      expect(missed.body.progress.progressPercent).toBeLessThan(100);
      for (const d of [-19, -18]) {
        await http.post('/api/v1/workout-logs').set(auth('memberB')).send({ exerciseId: ids.squat, workoutDate: daysFromToday(d), sets: 1, repetitions: 5, durationMinutes: 5 });
      }
      const upgraded = await http.get(`/api/v1/fitness-goals/${id}`).set(auth('memberB'));
      expect(upgraded.body).toMatchObject({ status: 'Completed', progress: { state: 'Achieved', progressPercent: 100 } });
    });
  });

  // =====================================================================
  describe('L5 — former trainer loses access to plan contents and completion data', () => {
    it('hides plans after reassignment but keeps the trainer\'s own feedback readable', async () => {
      const fb = await http.post('/api/v1/trainer-feedback').set(auth('trainer')).send({ memberId: ids.memberA, feedbackMessage: 'Solid week of squats, well done.', relatedPlanId: ids.plan });
      expect(fb.status).toBe(201);
      expect((await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('trainer'))).status).toBe(200);
      await http.put(`/api/v1/trainer-assignments/${ids.assign_memberA}`).set(auth('admin')).send({ trainerId: ids.trainer2, memberId: ids.memberA });

      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer')), 403);
      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('trainer')), 403);
      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}/plan-exercises`).set(auth('trainer')), 403);
      expectError(await http.get(`/api/v1/plan-exercises/${ids.pe}`).set(auth('trainer')), 403);
      const list = await http.get('/api/v1/workout-plans').set(auth('trainer'));
      expect(list.body.map((p: { planId: number }) => p.planId)).not.toContain(ids.plan);
      // Authorship history stays readable; the member's data does not.
      expect((await http.get(`/api/v1/trainer-feedback/${fb.body.feedbackId}`).set(auth('trainer'))).status).toBe(200);
      expectError(await http.get(`/api/v1/workout-logs?memberId=${ids.memberA}`).set(auth('trainer')), 403);
      // The member still sees their own plan.
      expect((await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('memberA'))).status).toBe(200);

      await http.put(`/api/v1/trainer-assignments/${ids.assign_memberA}`).set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.memberA });
      expect((await http.get(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer'))).status).toBe(200);
    });
  });

  // =====================================================================
  describe('L1, L4, L6 — input handling', () => {
    it('returns 413 in the standard format for an oversized body', async () => {
      const res = await http.post('/api/v1/users').set('Content-Type', 'application/json').send(JSON.stringify({ fullName: 'x'.repeat(200_000), email: 'big@qafix.test', password: PASSWORD }));
      expectError(res, 413);
      expect(res.body.message).toBe('Payload too large.');
    });

    it('rejects workouts and progress records dated tomorrow (Asia/Manila)', async () => {
      const tomorrow = daysFromToday(1);
      expectError(await http.post('/api/v1/workout-logs').set(auth('memberA')).send({ exerciseId: ids.squat, workoutDate: tomorrow, sets: 1, repetitions: 1, durationMinutes: 1 }), 400);
      expectError(await http.post('/api/v1/progress-records').set(auth('memberA')).send({ recordDate: tomorrow, weightKg: 70 }), 400);
      const log = await http.post('/api/v1/workout-logs').set(auth('memberA')).send({ exerciseId: ids.squat, workoutDate: today, sets: 1, repetitions: 1, durationMinutes: 1 });
      expect(log.status).toBe(201);
      expectError(await http.patch(`/api/v1/workout-logs/${log.body.logId}`).set(auth('memberA')).send({ workoutDate: tomorrow }), 400);
    });

    it('treats % and _ in search text literally', async () => {
      const all = await http.get('/api/v1/users?search=%25&limit=100').set(auth('admin'));
      expect(all.body.map((u: { fullName: string }) => u.fullName)).toEqual(['Promo 50% Member']);
      const underscore = await http.get('/api/v1/users?search=_&limit=100').set(auth('admin'));
      expect(underscore.body.map((u: { fullName: string }) => u.fullName)).toEqual(['Under_score Member']);
      const normal = await http.get('/api/v1/users?search=QA%20Member&limit=100').set(auth('admin'));
      expect(normal.body.length).toBe(3);
      const ex = await http.get('/api/v1/exercises?search=%25').set(auth('memberA'));
      expect(ex.body).toEqual([]);
    });
  });
});
