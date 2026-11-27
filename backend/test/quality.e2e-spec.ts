/**
 * FitSync Version 2.0 quality update — e2e tests for corrected behaviour:
 *   - timestamps are stored as UTC instants (no 8-hour shift) and calendar
 *     days follow the app time zone (Asia/Manila)
 *   - timed (duration-based) plan exercises: completion without repetitions
 *   - profile image validation
 *   - administrator-only role management and trainer assignments; public
 *     registration stays Member-only
 * Uses its own *@quality.test accounts against fitsync_test_db.
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

const PASSWORD = 'QualityPass123';
const today = daysFromToday(0);

describe('FitSync quality update (e2e)', () => {
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
  /** Seconds between a stored DATETIME (read raw) and UTC_TIMESTAMP(): ~0 for a UTC instant, ~28800 for UTC+8 wall-clock time. */
  const storedSkewSeconds = async (sql: string, id: number) => {
    const [row] = await db.query(`SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), (${sql})) AS skew`, [id]);
    return Math.abs(Number(row.skew));
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
    const people: Array<[string, Role]> = [
      ['admin', Role.Admin],
      ['trainer', Role.Trainer],
      ['member', Role.Member],
    ];
    const saved = await users.save(people.map(([key, role]) => users.create({ fullName: `Quality ${key}`, email: `${key}@quality.test`, role, passwordHash, isActive: true })));
    people.forEach(([key], i) => (ids[key] = saved[i].userId));
    for (const [key] of people) {
      tokens[key] = (await http.post('/api/v1/auth/login').send({ email: `${key}@quality.test`, password: PASSWORD })).body.accessToken;
    }
    ids.plank = (await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Quality Plank', category: 'Core' })).body.exerciseId;
    ids.squat = (await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Quality Squat', category: 'Strength' })).body.exerciseId;
  });

  afterAll(async () => {
    await app.close();
  });

  // =====================================================================
  describe('UTC timestamps and the app time zone', () => {
    it('stores registration, assignment and plan times as UTC instants (no 8-hour shift)', async () => {
      const reg = await http.post('/api/v1/users').send({ fullName: 'Time Zone Check', email: 'tz@quality.test', password: PASSWORD });
      expect(reg.status).toBe(201);
      ids.registered = reg.body.userId;
      // API value is the real instant…
      expect(Math.abs(Date.parse(reg.body.createdAt) - Date.now())).toBeLessThan(120_000);
      // …and so is the stored DATETIME (before the fix it was Manila wall-clock time, 8 h ahead of UTC).
      expect(await storedSkewSeconds('SELECT CreatedAt FROM Users WHERE UserID = ?', ids.registered)).toBeLessThan(120);

      const assignment = await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member });
      expect(assignment.status).toBe(201);
      expect(Math.abs(Date.parse(assignment.body.assignedAt) - Date.now())).toBeLessThan(120_000);
      expect(await storedSkewSeconds('SELECT AssignedAt FROM TrainerAssignments WHERE AssignmentID = ?', assignment.body.assignmentId)).toBeLessThan(120);

      const plan = await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ memberId: ids.member, planName: 'Quality Plan' });
      expect(plan.status).toBe(201);
      ids.plan = plan.body.planId;
      expect(Math.abs(Date.parse(plan.body.createdAt) - Date.now())).toBeLessThan(120_000);
      expect(await storedSkewSeconds('SELECT CreatedAt FROM WorkoutPlans WHERE PlanID = ?', ids.plan)).toBeLessThan(120);
    });

    it('counts plan workouts from the plan creation day in the app time zone', async () => {
      const res = await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('member'));
      expect(res.body.plan.countsFrom).toBe(today);
    });

    it('lists today’s registration in today’s admin report (app-time-zone day boundaries)', async () => {
      const res = await http.get(`/api/v1/reports/admin?period=custom&from=${today}&to=${today}`).set(auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body.registrations.inRange).toBeGreaterThanOrEqual(4);
      expect(res.body.registrations.series).toEqual([{ period: today, count: res.body.registrations.inRange }]);
    });
  });

  // =====================================================================
  describe('Timed (duration-based) plan exercises', () => {
    it('accepts a duration target without repetitions', async () => {
      const res = await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.plank, targetSets: 3, targetDurationMinutes: 3 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ targetSets: 3, targetDurationMinutes: 3, targetReps: 1 });
      ids.pePlank = res.body.planExerciseId;
    });

    it('still requires repetitions for repetition-based exercises', async () => {
      expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3 }), 400);
      const ok = await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3, targetReps: 10 });
      expect(ok.status).toBe(201);
      expect(ok.body.targetDurationMinutes).toBeNull();
      ids.peSquat = ok.body.planExerciseId;
    });

    it('validates duration targets', async () => {
      for (const targetDurationMinutes of [0, -5, 601, 2.5, 'ten']) {
        expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.plank, targetSets: 1, targetDurationMinutes }), 400);
      }
      expectError(await http.patch(`/api/v1/plan-exercises/${ids.pePlank}`).set(auth('trainer')).send({ targetDurationMinutes: 0 }), 400);
    });

    it('completes a timed exercise logged with 0 repetitions when the minutes are reached', async () => {
      const res = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.plank, planExerciseId: ids.pePlank, workoutDate: today, sets: 3, repetitions: 0, durationMinutes: 3 });
      expect(res.status).toBe(201);
      expect(res.body.completion).toMatchObject({ status: 'completed', scorePercent: 100, prescribed: { sets: 3, reps: 1, durationMinutes: 3 } });
    });

    it('counts a short timed workout as partial (minutes, not repetitions)', async () => {
      const res = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.plank, planExerciseId: ids.pePlank, workoutDate: today, sets: 3, repetitions: 50, durationMinutes: 1 });
      // 3/3 sets × 1/3 minutes = 33.3 % — 50 repetitions do not help a timed exercise.
      expect(res.body.completion).toMatchObject({ status: 'partial', scorePercent: 33.3 });
    });

    it('shows the duration target and the best timed attempt in the plan completion', async () => {
      const res = await http.get(`/api/v1/workout-plans/${ids.plan}/completion`).set(auth('trainer'));
      const plank = res.body.exercises.find((e: { planExerciseId: number }) => e.planExerciseId === ids.pePlank);
      expect(plank).toMatchObject({ status: 'completed', prescribed: { sets: 3, reps: 1, durationMinutes: 3 }, best: { prescribedAtTheTime: { durationMinutes: 3 } } });
      const squat = res.body.exercises.find((e: { planExerciseId: number }) => e.planExerciseId === ids.peSquat);
      expect(squat).toMatchObject({ status: 'pending', prescribed: { sets: 3, reps: 10, durationMinutes: null } });
    });

    it('keeps the snapshot when the duration target changes, and can switch back to repetitions', async () => {
      const upd = await http.patch(`/api/v1/plan-exercises/${ids.pePlank}`).set(auth('trainer')).send({ targetDurationMinutes: 5 });
      expect(upd.body.targetDurationMinutes).toBe(5);
      const history = await http.get(`/api/v1/workout-completions?planId=${ids.plan}`).set(auth('member'));
      expect(history.body.every((c: { prescribed: { durationMinutes: number } }) => c.prescribed.durationMinutes === 3)).toBe(true);

      const back = await http.patch(`/api/v1/plan-exercises/${ids.pePlank}`).set(auth('trainer')).send({ targetDurationMinutes: null, targetReps: 30 });
      expect(back.body).toMatchObject({ targetDurationMinutes: null, targetReps: 30 });
    });

    it('leaves repetition-based completion unchanged (backward compatible)', async () => {
      const res = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.squat, planExerciseId: ids.peSquat, workoutDate: today, sets: 3, repetitions: 0, durationMinutes: 60 });
      expect(res.body.completion).toMatchObject({ status: 'partial', scorePercent: 0, prescribed: { durationMinutes: null } });
    });
  });

  // =====================================================================
  describe('Profile image validation', () => {
    it('accepts web URLs and relative upload paths', async () => {
      for (const profileImg of ['https://example.com/photo.png', 'uploads/profiles/quality.jpg', null]) {
        const res = await http.patch(`/api/v1/users/${ids.member}`).set(auth('member')).send({ profileImg });
        expect(res.status).toBe(200);
        expect(res.body.profileImg).toBe(profileImg);
      }
    });

    it('rejects script URLs, data URLs, spaces and path traversal', async () => {
      for (const profileImg of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '../secret.png', 'uploads/../x.png', 'http://bad host/x.png', '/etc/passwd']) {
        expectError(await http.patch(`/api/v1/users/${ids.member}`).set(auth('member')).send({ profileImg }), 400);
      }
    });
  });

  // =====================================================================
  describe('Role management stays administrator-only', () => {
    it('keeps public registration Member-only', async () => {
      expectError(await http.post('/api/v1/users').send({ fullName: 'Role Hacker', email: 'hack@quality.test', password: PASSWORD, role: 'Admin' }), 400);
      const user = await http.get(`/api/v1/users/${ids.registered}`).set(auth('admin'));
      expect(user.body.role).toBe('Member');
    });

    it('lets only administrators change roles, create accounts and manage assignments', async () => {
      for (const who of ['member', 'trainer']) {
        expectError(await http.patch(`/api/v1/users/${ids.registered}/role`).set(auth(who)).send({ role: 'Admin' }), 403);
        expectError(await http.post('/api/v1/users/accounts').set(auth(who)).send({ fullName: 'X', email: `x-${who}@quality.test`, password: PASSWORD, role: 'Trainer' }), 403);
        expectError(await http.post('/api/v1/trainer-assignments').set(auth(who)).send({ trainerId: ids.trainer, memberId: ids.registered }), 403);
      }
      // A member cannot promote themselves through the profile endpoint either (unknown property -> 400).
      expectError(await http.patch(`/api/v1/users/${ids.member}`).set(auth('member')).send({ role: 'Admin' }), 400);

      const promoted = await http.patch(`/api/v1/users/${ids.registered}/role`).set(auth('admin')).send({ role: 'Trainer' });
      expect(promoted.status).toBe(200);
      expect(promoted.body.role).toBe('Trainer');
    });
  });
});
