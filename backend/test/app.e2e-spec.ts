/**
 * FitSync end-to-end tests.
 *
 * Boots the real NestJS application (same global pipes, guards and filters as
 * main.ts) against a real MySQL test database and exercises the API over HTTP.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Role } from '../src/common/enums';
import { daysFromToday } from '../src/common/utils/date.util';
import { User } from '../src/users/entities/user.entity';

const PASSWORD = 'TestPass123';

describe('FitSync API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  /** Asserts the Lab 05 error envelope. */
  const expectError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, statusCode: status });
    expect(typeof res.body.message).toBe('string');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(typeof res.body.timestamp).toBe('string');
  };

  const login = async (email: string, password = PASSWORD) =>
    http.post('/api/v1/auth/login').send({ email, password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    // Admin and trainer accounts cannot be self-registered, so the test
    // creates them directly in the test database (like the seed script).
    const users = app.get(DataSource).getRepository(User);
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const [admin, trainer, trainer2] = await users.save([
      users.create({ fullName: 'Test Admin', email: 'admin@e2e.test', role: Role.Admin, passwordHash, isActive: true }),
      users.create({ fullName: 'Test Trainer', email: 'trainer@e2e.test', role: Role.Trainer, passwordHash, isActive: true }),
      users.create({ fullName: 'Other Trainer', email: 'trainer2@e2e.test', role: Role.Trainer, passwordHash, isActive: true }),
    ]);
    ids.admin = admin.userId;
    ids.trainer = trainer.userId;
    ids.trainer2 = trainer2.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===================================================================
  describe('Authentication', () => {
    it('POST /users registers a Member (201) without exposing the password hash', async () => {
      const res = await http.post('/api/v1/users').send({ fullName: 'Juan Dela Cruz', email: 'Juan@E2E.test', password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ fullName: 'Juan Dela Cruz', email: 'juan@e2e.test', role: 'Member', isActive: true, profileImg: null });
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('createdAt');
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      ids.member = res.body.userId;

      const res2 = await http.post('/api/v1/users').send({ fullName: 'Ana Garcia', email: 'ana@e2e.test', password: PASSWORD });
      expect(res2.status).toBe(201);
      ids.member2 = res2.body.userId;
    });

    it('rejects a duplicate email with 409', async () => {
      const res = await http.post('/api/v1/users').send({ fullName: 'Copy', email: 'juan@e2e.test', password: PASSWORD });
      expectError(res, 409);
      expect(res.body.message).toBe('Email already registered.');
    });

    it('rejects invalid registration input with 400 and field messages', async () => {
      const res = await http.post('/api/v1/users').send({ fullName: '', email: 'not-an-email', password: 'short' });
      expectError(res, 400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining(['Full name is required.', 'Email must be a valid email address.', 'Password must be at least 8 characters.']),
      );
    });

    it('does not allow public registration to choose a role (400)', async () => {
      const res = await http.post('/api/v1/users').send({ fullName: 'Hacker', email: 'h@e2e.test', password: PASSWORD, role: 'Admin' });
      expectError(res, 400);
    });

    it('logs in each role and returns a JWT', async () => {
      for (const [key, email] of [
        ['admin', 'admin@e2e.test'],
        ['trainer', 'trainer@e2e.test'],
        ['trainer2', 'trainer2@e2e.test'],
        ['member', 'juan@e2e.test'],
        ['member2', 'ana@e2e.test'],
      ]) {
        const res = await login(email);
        expect(res.status).toBe(200);
        expect(res.body.tokenType).toBe('Bearer');
        expect(res.body.accessToken.split('.')).toHaveLength(3);
        expect(res.body.user.email).toBe(email);
        expect(res.body.user).not.toHaveProperty('passwordHash');
        tokens[key] = res.body.accessToken;
      }
    });

    it('rejects a wrong password and an unknown email with the same 401', async () => {
      const wrong = await login('juan@e2e.test', 'WrongPass999');
      const unknown = await login('nobody@e2e.test', 'WrongPass999');
      expectError(wrong, 401);
      expectError(unknown, 401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('returns 401 when the token is missing, malformed or signed with another secret', async () => {
      expectError(await http.get('/api/v1/auth/me'), 401);
      expectError(await http.get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt'), 401);
      const forged = sign({ sub: ids.admin, role: 'Admin' }, 'some-other-secret-value-that-is-long-enough');
      expectError(await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`), 401);
    });

    it('returns 401 for an expired token', async () => {
      const expired = sign(
        { sub: ids.member, email: 'juan@e2e.test', role: 'Member', exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET!,
      );
      const res = await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
      expectError(res, 401);
      expect(res.body.errors[0]).toMatch(/expired/i);
    });

    it('GET /auth/me returns the current user', async () => {
      const res = await http.get('/api/v1/auth/me').set(auth('member'));
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(ids.member);
    });

    it('PATCH /auth/password changes the password (and rejects a wrong current password)', async () => {
      expectError(
        await http.patch('/api/v1/auth/password').set(auth('member2')).send({ currentPassword: 'Nope12345', newPassword: 'NewPass456' }),
        400,
      );
      const ok = await http.patch('/api/v1/auth/password').set(auth('member2')).send({ currentPassword: PASSWORD, newPassword: 'NewPass456' });
      expect(ok.status).toBe(200);
      expect((await login('ana@e2e.test', 'NewPass456')).status).toBe(200);
      expectError(await login('ana@e2e.test', PASSWORD), 401);
    });
  });

  // ===================================================================
  describe('Users', () => {
    it('lets a member view and update their own profile (PATCH 200)', async () => {
      expect((await http.get(`/api/v1/users/${ids.member}`).set(auth('member'))).status).toBe(200);
      const res = await http
        .patch(`/api/v1/users/${ids.member}`)
        .set(auth('member'))
        .send({ fullName: 'Jay Cruz', profileImg: 'uploads/profiles/juan.jpg' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ userId: ids.member, fullName: 'Jay Cruz', profileImg: 'uploads/profiles/juan.jpg' });
    });

    it('returns 403 when a member views or edits another profile', async () => {
      expectError(await http.get(`/api/v1/users/${ids.member2}`).set(auth('member')), 403);
      expectError(await http.patch(`/api/v1/users/${ids.member2}`).set(auth('member')).send({ fullName: 'X' }), 403);
    });

    it('returns 404 for a user that does not exist (admin)', async () => {
      const res = await http.get('/api/v1/users/999999').set(auth('admin'));
      expectError(res, 404);
      expect(res.body.message).toBe('User not found.');
    });

    it('returns 409 when changing email to one already registered', async () => {
      expectError(await http.patch(`/api/v1/users/${ids.member}`).set(auth('member')).send({ email: 'ana@e2e.test' }), 409);
    });

    it('lists users for admins only, with pagination headers', async () => {
      expectError(await http.get('/api/v1/users').set(auth('member')), 403);
      const res = await http.get('/api/v1/users?role=Member&limit=1&page=1').set(auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.headers['x-total-count']).toBe('2');
      expect(res.headers['x-total-pages']).toBe('2');
    });

    it('lets an admin create a Trainer account (201)', async () => {
      const res = await http
        .post('/api/v1/users/accounts')
        .set(auth('admin'))
        .send({ fullName: 'New Coach', email: 'coach@e2e.test', password: PASSWORD, role: 'Trainer' });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('Trainer');
      expectError(
        await http.post('/api/v1/users/accounts').set(auth('trainer')).send({ fullName: 'X', email: 'x@e2e.test', password: PASSWORD, role: 'Admin' }),
        403,
      );
    });
  });

  // ===================================================================
  describe('Exercises', () => {
    it('lets admins add exercises (201) and rejects members (403)', async () => {
      const res = await http
        .post('/api/v1/exercises')
        .set(auth('admin'))
        .send({ exerciseName: 'Plank', category: 'Core', description: 'Core strengthening exercise' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ exerciseName: 'Plank', category: 'Core' });
      ids.plank = res.body.exerciseId;

      const squat = await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Squat', category: 'Strength' });
      ids.squat = squat.body.exerciseId;
      const temp = await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Temp Move', category: 'Other' });
      ids.temp = temp.body.exerciseId;

      expectError(await http.post('/api/v1/exercises').set(auth('member')).send({ exerciseName: 'X', category: 'Y' }), 403);
    });

    it('validates exercise input (400) and duplicate names (409)', async () => {
      const res = await http.post('/api/v1/exercises').set(auth('admin')).send({ category: 'Core' });
      expectError(res, 400);
      expect(res.body.errors).toContain('Exercise name is required.');
      expectError(await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'plank', category: 'Core' }), 409);
    });

    it('lets any authenticated user browse and filter the catalog', async () => {
      expectError(await http.get('/api/v1/exercises'), 401);
      const res = await http.get('/api/v1/exercises?category=Core').set(auth('member'));
      expect(res.status).toBe(200);
      expect(res.body.map((e: { exerciseName: string }) => e.exerciseName)).toEqual(['Plank']);
      const cats = await http.get('/api/v1/exercises/categories').set(auth('member'));
      expect(cats.body).toEqual(expect.arrayContaining(['Core', 'Strength']));
      expectError(await http.get('/api/v1/exercises/999999').set(auth('member')), 404);
    });

    it('replaces an exercise with PUT (200)', async () => {
      const res = await http
        .put(`/api/v1/exercises/${ids.squat}`)
        .set(auth('admin'))
        .send({ exerciseName: 'Squat', category: 'Strength', description: 'Lower-body exercise' });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Lower-body exercise');
    });
  });

  // ===================================================================
  describe('Trainer assignments', () => {
    it('lets an admin assign a trainer (201) and rejects duplicates (409)', async () => {
      const res = await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ trainerId: ids.trainer, memberId: ids.member });
      expect(res.body).toHaveProperty('assignedAt');
      ids.assignment = res.body.assignmentId;

      const dup = await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member });
      expectError(dup, 409);
      expect(dup.body.message).toBe('Assignment already exists.');
    });

    it('validates roles (400), missing users (404) and permissions (403)', async () => {
      expectError(await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.member, memberId: ids.member2 }), 400);
      expectError(await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: 999999, memberId: ids.member }), 404);
      expectError(await http.post('/api/v1/trainer-assignments').set(auth('trainer')).send({ trainerId: ids.trainer, memberId: ids.member2 }), 403);
    });

    it('scopes the list: a trainer only sees their own members', async () => {
      const res = await http.get('/api/v1/trainer-assignments').set(auth('trainer'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].member.userId).toBe(ids.member);
      const other = await http.get('/api/v1/trainer-assignments').set(auth('trainer2'));
      expect(other.body).toHaveLength(0);
    });
  });

  // ===================================================================
  describe('Workout plans & plan exercises', () => {
    it('lets an assigned trainer create a plan (201)', async () => {
      const res = await http
        .post('/api/v1/workout-plans')
        .set(auth('trainer'))
        .send({ trainerId: ids.trainer, memberId: ids.member, planName: 'Beginner Workout' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ trainerId: ids.trainer, memberId: ids.member, planName: 'Beginner Workout' });
      ids.plan = res.body.planId;
    });

    it('returns 403 for unassigned trainers, foreign trainerIds and members', async () => {
      const unassigned = await http.post('/api/v1/workout-plans').set(auth('trainer2')).send({ memberId: ids.member, planName: 'X' });
      expectError(unassigned, 403);
      expect(unassigned.body.errors).toContain('Only assigned trainers can create plans.');
      expectError(await http.post('/api/v1/workout-plans').set(auth('trainer')).send({ trainerId: ids.trainer2, memberId: ids.member, planName: 'X' }), 403);
      expectError(await http.post('/api/v1/workout-plans').set(auth('member')).send({ memberId: ids.member, planName: 'X' }), 403);
    });

    it('replaces a plan with PUT (200) and returns 404 for unknown plans', async () => {
      const res = await http
        .put(`/api/v1/workout-plans/${ids.plan}`)
        .set(auth('trainer'))
        .send({ trainerId: ids.trainer, memberId: ids.member, planName: 'Advanced Workout' });
      expect(res.status).toBe(200);
      expect(res.body.planName).toBe('Advanced Workout');
      const missing = await http.put('/api/v1/workout-plans/999999').set(auth('trainer')).send({ memberId: ids.member, planName: 'X' });
      expectError(missing, 404);
      expect(missing.body.message).toBe('Workout plan not found.');
    });

    it('adds an exercise to the plan (201) with validation, 404 and 409 cases', async () => {
      const res = await http
        .post('/api/v1/plan-exercises')
        .set(auth('trainer'))
        .send({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3, targetReps: 12 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3, targetReps: 12 });
      ids.planExercise = res.body.planExerciseId;

      expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.plank, targetSets: 0, targetReps: 12 }), 400);
      expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: 999999, exerciseId: ids.plank, targetSets: 3, targetReps: 12 }), 404);
      expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer')).send({ planId: ids.plan, exerciseId: ids.squat, targetSets: 3, targetReps: 12 }), 409);
      expectError(await http.post('/api/v1/plan-exercises').set(auth('trainer2')).send({ planId: ids.plan, exerciseId: ids.plank, targetSets: 3, targetReps: 12 }), 403);
    });

    it('updates targets with PATCH and lists the nested plan exercises', async () => {
      const res = await http.patch(`/api/v1/plan-exercises/${ids.planExercise}`).set(auth('trainer')).send({ targetReps: 15 });
      expect(res.status).toBe(200);
      expect(res.body.targetReps).toBe(15);

      const nested = await http.get(`/api/v1/workout-plans/${ids.plan}/plan-exercises`).set(auth('member'));
      expect(nested.status).toBe(200);
      expect(nested.body).toHaveLength(1);
      expect(nested.body[0].exercise.exerciseName).toBe('Squat');
    });

    it('lets the member see their plan but not other users', async () => {
      const mine = await http.get('/api/v1/workout-plans').set(auth('member'));
      expect(mine.body.map((p: { planId: number }) => p.planId)).toContain(ids.plan);
      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}`).set(auth('member2')), 403);
      expectError(await http.get(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer2')), 403);
    });
  });

  // ===================================================================
  describe('Workout logs', () => {
    const today = daysFromToday(0);

    it('records a workout for the logged-in member (201)', async () => {
      const res = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ memberId: ids.member, exerciseId: ids.squat, workoutDate: today, sets: 3, repetitions: 12, durationMinutes: 20 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ memberId: ids.member, exerciseId: ids.squat, workoutDate: today, sets: 3, repetitions: 12, durationMinutes: 20 });
      ids.log = res.body.logId;
    });

    it('rejects invalid workout data with 400', async () => {
      const zeroSets = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.squat, workoutDate: today, sets: 0, repetitions: 12, durationMinutes: 20 });
      expectError(zeroSets, 400);
      expect(zeroSets.body.errors).toContain('Sets must be greater than zero.');

      const future = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.squat, workoutDate: daysFromToday(10), sets: 3, repetitions: 12, durationMinutes: 20 });
      expectError(future, 400);

      const badDate = await http
        .post('/api/v1/workout-logs')
        .set(auth('member'))
        .send({ exerciseId: ids.squat, workoutDate: '2026-02-30', sets: 3, repetitions: 12, durationMinutes: 20 });
      expectError(badDate, 400);
    });

    it('returns 404 for an unknown exercise and 403 for another member or a trainer', async () => {
      expectError(
        await http.post('/api/v1/workout-logs').set(auth('member')).send({ exerciseId: 999999, workoutDate: today, sets: 3, repetitions: 1, durationMinutes: 1 }),
        404,
      );
      expectError(
        await http.post('/api/v1/workout-logs').set(auth('member')).send({ memberId: ids.member2, exerciseId: ids.squat, workoutDate: today, sets: 3, repetitions: 1, durationMinutes: 1 }),
        403,
      );
      expectError(
        await http.post('/api/v1/workout-logs').set(auth('trainer')).send({ exerciseId: ids.squat, workoutDate: today, sets: 3, repetitions: 1, durationMinutes: 1 }),
        403,
      );
    });

    it('GET /workout-logs?memberId= enforces ownership and trainer assignment', async () => {
      const own = await http.get(`/api/v1/workout-logs?memberId=${ids.member}`).set(auth('member'));
      expect(own.status).toBe(200);
      expect(own.body).toHaveLength(1);

      const other = await http.get(`/api/v1/workout-logs?memberId=${ids.member}`).set(auth('member2'));
      expectError(other, 403);
      expect(other.body.errors).toContain('Not authorized to view these workouts.');

      expect((await http.get(`/api/v1/workout-logs?memberId=${ids.member}`).set(auth('trainer'))).body).toHaveLength(1);
      expectError(await http.get(`/api/v1/workout-logs?memberId=${ids.member}`).set(auth('trainer2')), 403);
      expect((await http.get('/api/v1/workout-logs').set(auth('trainer2'))).body).toHaveLength(0);
    });

    it('lets only the owner update a workout (PATCH 200 / 403)', async () => {
      const res = await http.patch(`/api/v1/workout-logs/${ids.log}`).set(auth('member')).send({ repetitions: 15 });
      expect(res.status).toBe(200);
      expect(res.body.repetitions).toBe(15);
      expectError(await http.patch(`/api/v1/workout-logs/${ids.log}`).set(auth('member2')).send({ repetitions: 1 }), 403);
    });
  });

  // ===================================================================
  describe('Progress records', () => {
    it('adds a progress record (201) with weight as a number', async () => {
      const res = await http
        .post('/api/v1/progress-records')
        .set(auth('member'))
        .send({ memberId: ids.member, recordDate: daysFromToday(0), weightKg: 65.5, notes: 'Improved endurance' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ memberId: ids.member, weightKg: 65.5, notes: 'Improved endurance' });
      ids.progress = res.body.progressId;
    });

    it('rejects a non-positive weight with 400', async () => {
      const res = await http.post('/api/v1/progress-records').set(auth('member')).send({ recordDate: daysFromToday(0), weightKg: -2 });
      expectError(res, 400);
      expect(res.body.errors).toContain('Weight must be greater than zero.');
    });

    it('GET /progress-records/{id}: owner and assigned trainer 200, others 403, unknown 404', async () => {
      expect((await http.get(`/api/v1/progress-records/${ids.progress}`).set(auth('member'))).status).toBe(200);
      expect((await http.get(`/api/v1/progress-records/${ids.progress}`).set(auth('trainer'))).status).toBe(200);
      expectError(await http.get(`/api/v1/progress-records/${ids.progress}`).set(auth('trainer2')), 403);
      expectError(await http.get(`/api/v1/progress-records/${ids.progress}`).set(auth('member2')), 403);
      const missing = await http.get('/api/v1/progress-records/999999').set(auth('member'));
      expectError(missing, 404);
      expect(missing.body.message).toBe('Progress record not found.');
    });

    it('updates (PATCH 200) and deletes (204) the record', async () => {
      const res = await http.patch(`/api/v1/progress-records/${ids.progress}`).set(auth('member')).send({ weightKg: 64.8 });
      expect(res.status).toBe(200);
      expect(res.body.weightKg).toBe(64.8);
      expect((await http.delete(`/api/v1/progress-records/${ids.progress}`).set(auth('member'))).status).toBe(204);
      expectError(await http.get(`/api/v1/progress-records/${ids.progress}`).set(auth('member')), 404);
    });
  });

  // ===================================================================
  describe('Dashboards', () => {
    it('returns role-specific statistics computed from the database', async () => {
      const member = await http.get('/api/v1/dashboard/member').set(auth('member'));
      expect(member.status).toBe(200);
      expect(member.body.summary.totalWorkouts).toBe(1);
      expect(member.body.activity).toHaveLength(14);

      const trainer = await http.get('/api/v1/dashboard/trainer').set(auth('trainer'));
      expect(trainer.body.summary.assignedMembers).toBe(1);

      const admin = await http.get('/api/v1/dashboard/admin').set(auth('admin'));
      expect(admin.body.users.members).toBe(2);
      expect(admin.body.totals.workoutLogs).toBe(1);
    });

    it('denies other roles access to a dashboard (403)', async () => {
      expectError(await http.get('/api/v1/dashboard/admin').set(auth('member')), 403);
      expectError(await http.get('/api/v1/dashboard/trainer').set(auth('admin')), 403);
    });
  });

  // ===================================================================
  describe('Referential integrity and deletes', () => {
    it('blocks deleting an exercise that is used (409) and deletes an unused one (204)', async () => {
      const used = await http.delete(`/api/v1/exercises/${ids.squat}`).set(auth('admin'));
      expectError(used, 409);
      expect((await http.delete(`/api/v1/exercises/${ids.temp}`).set(auth('admin'))).status).toBe(204);
    });

    it('deletes a workout log (204) and then reports it missing (404)', async () => {
      expectError(await http.delete(`/api/v1/workout-logs/${ids.log}`).set(auth('member2')), 403);
      expect((await http.delete(`/api/v1/workout-logs/${ids.log}`).set(auth('member'))).status).toBe(204);
      expectError(await http.get(`/api/v1/workout-logs/${ids.log}`).set(auth('member')), 404);
    });

    it('deleting a plan cascades to its plan exercises', async () => {
      expect((await http.delete(`/api/v1/workout-plans/${ids.plan}`).set(auth('trainer'))).status).toBe(204);
      expectError(await http.get(`/api/v1/plan-exercises/${ids.planExercise}`).set(auth('trainer')), 404);
    });

    it('removing an assignment immediately revokes the trainer\'s access', async () => {
      expect((await http.delete(`/api/v1/trainer-assignments/${ids.assignment}`).set(auth('admin'))).status).toBe(204);
      expectError(await http.get(`/api/v1/workout-logs?memberId=${ids.member}`).set(auth('trainer')), 403);
    });
  });

  // ===================================================================
  describe('Account deactivation', () => {
    it('DELETE /users/{id} deactivates (204); the old token and login are rejected (401)', async () => {
      expectError(await http.delete(`/api/v1/users/${ids.member}`).set(auth('member2')), 403);
      expect((await http.delete(`/api/v1/users/${ids.member2}`).set(auth('member2'))).status).toBe(204);
      expectError(await http.get('/api/v1/auth/me').set(auth('member2')), 401);
      const res = await login('ana@e2e.test', 'NewPass456');
      expectError(res, 401);
      expect(res.body.message).toBe('Account is deactivated.');
    });

    it('lets an admin re-activate the account', async () => {
      const res = await http.patch(`/api/v1/users/${ids.member2}/activate`).set(auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
      expect((await login('ana@e2e.test', 'NewPass456')).status).toBe(200);
    });

    it('prevents deactivating the last active admin (409)', async () => {
      expectError(await http.delete(`/api/v1/users/${ids.admin}`).set(auth('admin')), 409);
    });
  });

  // ===================================================================
  describe('Login rate limiting', () => {
    it('returns 429 after too many login attempts', async () => {
      process.env.LOGIN_RATE_LIMIT = '3';
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await login('juan@e2e.test', 'WrongPass999')).status);
      process.env.LOGIN_RATE_LIMIT = '1000';
      expect(statuses).toContain(429);
    });
  });
});
