/**
 * FitSync e2e tests for the Lab-alignment upgrade:
 *   - External Fitness API (wger) — upstream responses are MOCKED with
 *     recorded fixtures so the tests are deterministic and work offline
 *   - Fitness Reports (member / trainer / admin, CSV export)
 *
 * Runs the real AppModule against the MySQL test database (fitsync_test_db).
 * Uses its own *@upgrade.test accounts so it is independent of app.e2e-spec.
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
import { wgerFixtures } from './fixtures/wger.fixtures';

const PASSWORD = 'UpgradePass123';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Routes mocked wger requests by path; `override` lets a test change one route. */
let override: ((url: URL, init?: RequestInit) => Promise<Response> | Response | undefined) | null = null;
function installWgerMock() {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://wger.de') throw new Error(`Unexpected outbound request to ${url.origin}`);
    const custom = override?.(url, init);
    if (custom) return custom;
    switch (url.pathname) {
      case '/api/v2/exerciseinfo/':
        return json(wgerFixtures.list);
      case '/api/v2/exerciseinfo/73/':
        return json(wgerFixtures.list.results[0]);
      case '/api/v2/exerciseinfo/91/':
        return json(wgerFixtures.list.results[1]);
      case '/api/v2/license/':
        return json(wgerFixtures.licenses);
      case '/api/v2/exercisecategory/':
        return json(wgerFixtures.categories);
      case '/api/v2/equipment/':
        return json(wgerFixtures.equipment);
      default:
        void init;
        return json({ detail: 'No Exercise matches the given query.' }, 404);
    }
  });
}

describe('FitSync upgrade (e2e): external fitness API and reports', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let fetchSpy: jest.SpyInstance;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const expectError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, statusCode: status });
    expect(Array.isArray(res.body.errors)).toBe(true);
  };

  beforeAll(async () => {
    fetchSpy = installWgerMock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get(DataSource);

    const users = db.getRepository(User);
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const make = (fullName: string, email: string, role: Role) => users.create({ fullName, email, role, passwordHash, isActive: true });
    const saved = await users.save([
      make('Upgrade Admin', 'admin@upgrade.test', Role.Admin),
      make('Upgrade Trainer', 'trainer@upgrade.test', Role.Trainer),
      make('Other Upgrade Trainer', 'trainer2@upgrade.test', Role.Trainer),
      make('Report Member', 'member@upgrade.test', Role.Member),
      make('Empty Member', 'empty@upgrade.test', Role.Member),
      make('Csv Member', 'csv@upgrade.test', Role.Member),
    ]);
    ['admin', 'trainer', 'trainer2', 'member', 'empty', 'csv'].forEach((key, i) => (ids[key] = saved[i].userId));
    for (const [key, email] of Object.entries({
      admin: 'admin@upgrade.test',
      trainer: 'trainer@upgrade.test',
      trainer2: 'trainer2@upgrade.test',
      member: 'member@upgrade.test',
      empty: 'empty@upgrade.test',
      csv: 'csv@upgrade.test',
    })) {
      const res = await http.post('/api/v1/auth/login').send({ email, password: PASSWORD });
      tokens[key] = res.body.accessToken;
    }
  });

  afterEach(() => {
    override = null;
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await app.close();
  });

  // =====================================================================
  describe('External Fitness API (mocked wger)', () => {
    it('lets every role browse normalized exercises with pagination headers', async () => {
      for (const who of ['member', 'trainer', 'admin']) {
        const res = await http.get('/api/v1/external-fitness/exercises?page=1&limit=12').set(auth(who));
        expect(res.status).toBe(200);
        expect(res.headers['x-data-source']).toBe('wger');
        expect(res.headers['x-total-count']).toBe('2');
        expect(res.body[0]).toMatchObject({
          externalId: 73,
          name: 'Bench Press',
          category: { id: 11, name: 'Chest' },
          attribution: { license: 'CC-BY-SA 3', author: 'Everkinetic', sourceUrl: 'https://wger.de/en/exercise/73/view/' },
        });
        expect(res.body[0].description).not.toMatch(/<|script/);
      }
    });

    it('passes search and pagination to wger and validates the query', async () => {
      fetchSpy.mockClear();
      const res = await http.get('/api/v1/external-fitness/exercises?search=bench&category=11&page=2&limit=5').set(auth('member'));
      expect(res.status).toBe(200);
      const called = fetchSpy.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === '/api/v2/exerciseinfo/')!;
      expect(called.searchParams.get('name__search')).toBe('bench');
      expect(called.searchParams.get('offset')).toBe('5');
      expect(called.searchParams.get('limit')).toBe('5');

      expectError(await http.get('/api/v1/external-fitness/exercises?limit=500').set(auth('member')), 400);
      expectError(await http.get('/api/v1/external-fitness/exercises?category=abc').set(auth('member')), 400);
      expectError(await http.get('/api/v1/external-fitness/exercises?search=a').set(auth('member')), 400);
    });

    it('requires authentication', async () => {
      expectError(await http.get('/api/v1/external-fitness/exercises'), 401);
      expectError(await http.get('/api/v1/external-fitness/categories'), 401);
    });

    it('returns categories, equipment and exercise details', async () => {
      const cats = await http.get('/api/v1/external-fitness/categories').set(auth('member'));
      expect(cats.body).toEqual([
        { id: 10, name: 'Abs' },
        { id: 11, name: 'Chest' },
      ]);
      const equipment = await http.get('/api/v1/external-fitness/equipment').set(auth('member'));
      expect(equipment.body.map((e: { name: string }) => e.name)).toEqual(['Barbell', 'Bench']);
      const detail = await http.get('/api/v1/external-fitness/exercises/73').set(auth('trainer'));
      expect(detail.status).toBe(200);
      expect(detail.body.images).toHaveLength(1);
      expectError(await http.get('/api/v1/external-fitness/exercises/5555').set(auth('member')), 404);
    });

    it('returns 503 when wger is unavailable (no invented data)', async () => {
      override = (url) => (url.pathname === '/api/v2/exerciseinfo/' ? Promise.reject(new TypeError('fetch failed')) : undefined);
      const res = await http.get('/api/v1/external-fitness/exercises?search=unavailable').set(auth('member'));
      expectError(res, 503);
      expect(res.body.message).toBe('External fitness service unavailable.');
    });

    it('returns 504 when wger times out', async () => {
      // A server that never answers: like real fetch, the request only ends
      // when the client's AbortSignal fires after WGER_TIMEOUT_MS.
      override = (url, init) =>
        url.pathname === '/api/v2/exerciseinfo/'
          ? new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))
          : undefined;
      const res = await http.get('/api/v1/external-fitness/exercises?search=timeout').set(auth('member'));
      expectError(res, 504);
    });

    it('returns 502 for a malformed upstream response', async () => {
      override = (url) => (url.pathname === '/api/v2/exerciseinfo/' ? json({ count: 'many', results: {} }) : undefined);
      expectError(await http.get('/api/v1/external-fitness/exercises?search=malformed').set(auth('member')), 502);
    });

    it('only admins can import; duplicates are refused', async () => {
      expectError(await http.post('/api/v1/external-fitness/exercises/91/import').set(auth('member')), 403);
      expectError(await http.post('/api/v1/external-fitness/exercises/91/import').set(auth('trainer')), 403);
      expectError(await http.post('/api/v1/external-fitness/exercises/91/import'), 401);

      const res = await http.post('/api/v1/external-fitness/exercises/91/import').set(auth('admin'));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        exerciseName: 'Crunches',
        category: 'Abs',
        source: { provider: 'wger', externalId: 91, license: 'CC-BY-SA 4', sourceUrl: 'https://wger.de/en/exercise/91/view/' },
      });
      ids.importedExercise = res.body.exerciseId;

      const again = await http.post('/api/v1/external-fitness/exercises/91/import').set(auth('admin'));
      expectError(again, 409);
      expect(again.body.message).toBe('Exercise already imported.');
    });

    it('refuses an import whose name already exists locally', async () => {
      await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Bench Press', category: 'Strength' });
      const res = await http.post('/api/v1/external-fitness/exercises/73/import').set(auth('admin'));
      expectError(res, 409);
      expect(res.body.message).toBe('Exercise already exists.');
    });

    it('imported exercises appear in the local catalog and work with workout logs', async () => {
      const list = await http.get('/api/v1/external-fitness/exercises?search=crunches').set(auth('member'));
      expect(list.body.find((e: { externalId: number }) => e.externalId === 91).localExerciseId).toBe(ids.importedExercise);

      const local = await http.get(`/api/v1/exercises/${ids.importedExercise}`).set(auth('member'));
      expect(local.body.source.provider).toBe('wger');

      const log = await http
        .post('/api/v1/workout-logs')
        .set(auth('csv'))
        .send({ exerciseId: ids.importedExercise, workoutDate: daysFromToday(0), sets: 2, repetitions: 15, durationMinutes: 5 });
      expect(log.status).toBe(201);
    });

    it('local exercises keep their original shape with source = null', async () => {
      const res = await http.get('/api/v1/exercises?search=Bench').set(auth('member'));
      const local = res.body.find((e: { exerciseName: string }) => e.exerciseName === 'Bench Press');
      expect(Object.keys(local).sort()).toEqual(['category', 'description', 'exerciseId', 'exerciseName', 'source']);
      expect(local.source).toBeNull();
    });
  });

  // =====================================================================
  describe('Fitness reports', () => {
    const d0 = daysFromToday(0);
    const d1 = daysFromToday(-1);
    const d2 = daysFromToday(-2);
    const d5 = daysFromToday(-5);

    beforeAll(async () => {
      const ex1 = await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Report Squat', category: 'Strength' });
      const ex2 = await http.post('/api/v1/exercises').set(auth('admin')).send({ exerciseName: 'Report Row', category: 'Back' });
      ids.squat = ex1.body.exerciseId;
      ids.row = ex2.body.exerciseId;
      const log = (exerciseId: number, workoutDate: string, sets: number, repetitions: number, durationMinutes: number) =>
        http.post('/api/v1/workout-logs').set(auth('member')).send({ exerciseId, workoutDate, sets, repetitions, durationMinutes });
      await log(ids.squat, d0, 3, 10, 20);
      await log(ids.row, d0, 4, 8, 15);
      await log(ids.squat, d2, 5, 5, 30);
      await http.post('/api/v1/progress-records').set(auth('member')).send({ recordDate: d5, weightKg: 80 });
      await http.post('/api/v1/progress-records').set(auth('member')).send({ recordDate: d1, weightKg: 78.5, notes: 'Good week' });
      await http.post('/api/v1/trainer-assignments').set(auth('admin')).send({ trainerId: ids.trainer, memberId: ids.member });
    });

    it('calculates the member report from real records (weekly period)', async () => {
      const res = await http.get('/api/v1/reports/member?period=week').set(auth('member'));
      expect(res.status).toBe(200);
      expect(res.body.range).toEqual({ period: 'week', from: daysFromToday(-6), to: d0, days: 7 });
      expect(res.body.summary).toEqual({
        totalWorkouts: 3,
        totalDurationMinutes: 65, // 20 + 15 + 30
        totalSets: 12, // 3 + 4 + 5
        totalRepetitions: 87, // 3×10 + 4×8 + 5×5
        distinctWorkoutDays: 2,
        consistencyPercent: 28.6, // 2 of 7 days
        averageMinutesPerWorkoutDay: 32.5, // 65 / 2
        averageWorkoutsPerWeek: 3,
        longestStreakDays: 1,
      });
      expect(res.body.exerciseFrequency.map((e: { exerciseName: string; workouts: number }) => [e.exerciseName, e.workouts])).toEqual([
        ['Report Squat', 2],
        ['Report Row', 1],
      ]);
      expect(res.body.categoryBreakdown).toEqual([
        { category: 'Strength', workouts: 2, minutes: 50, percent: 66.7 },
        { category: 'Back', workouts: 1, minutes: 15, percent: 33.3 },
      ]);
      expect(res.body.weight).toMatchObject({ measurements: 2, startWeightKg: 80, endWeightKg: 78.5, changeKg: -1.5, minKg: 78.5, maxKg: 80 });
      expect(res.body.daily).toHaveLength(7);
      expect(res.body.notes).toEqual([{ date: d1, notes: 'Good week' }]);
    });

    it('respects a custom date range', async () => {
      const res = await http.get(`/api/v1/reports/member?from=${daysFromToday(-3)}&to=${d1}`).set(auth('member'));
      expect(res.status).toBe(200);
      expect(res.body.range.period).toBe('custom');
      expect(res.body.summary.totalWorkouts).toBe(1); // only the d-2 squat
      expect(res.body.weight).toMatchObject({ measurements: 1, endWeightKg: 78.5, changeKg: null });
    });

    it('returns zeros, not errors, for a member without data', async () => {
      const res = await http.get('/api/v1/reports/member?period=month').set(auth('empty'));
      expect(res.status).toBe(200);
      expect(res.body.summary).toMatchObject({ totalWorkouts: 0, totalDurationMinutes: 0, distinctWorkoutDays: 0, consistencyPercent: 0, longestStreakDays: 0 });
      expect(res.body.exerciseFrequency).toEqual([]);
      expect(res.body.categoryBreakdown).toEqual([]);
      expect(res.body.weight).toMatchObject({ measurements: 0, startWeightKg: null, changeKg: null, trend: [] });
      expect(res.body.daily).toHaveLength(30);
    });

    it('rejects invalid date ranges with 400', async () => {
      const bad = [
        `from=${d0}&to=${d2}`, // from after to
        'from=2026-13-01&to=2026-12-01', // not a date
        `from=${d2}`, // missing to
        'period=custom',
        `period=week&from=${d2}&to=${d0}`,
        'period=year',
        `from=${daysFromToday(-400)}&to=${d0}`, // more than 366 days
        `from=${d0}&to=${daysFromToday(5)}`, // future
        'format=xml',
      ];
      for (const query of bad) expectError(await http.get(`/api/v1/reports/member?${query}`).set(auth('member')), 400);
    });

    it('trainer report covers assigned members only', async () => {
      const res = await http.get('/api/v1/reports/trainer?period=week').set(auth('trainer'));
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toMatchObject({
        member: { userId: ids.member },
        totalWorkouts: 3,
        totalDurationMinutes: 65,
        distinctWorkoutDays: 2,
        consistencyPercent: 28.6,
        latestWeightKg: 78.5,
        weightChangeKg: -1.5,
      });
      expect(res.body.summary).toMatchObject({ assignedMembers: 1, activeMembers: 1, totalWorkouts: 3 });

      const other = await http.get('/api/v1/reports/trainer?period=week').set(auth('trainer2'));
      expect(other.body.members).toEqual([]);
      expect(other.body.summary.totalWorkouts).toBe(0);
    });

    it('trainer can open an assigned member report and is refused for others', async () => {
      const ok = await http.get(`/api/v1/reports/trainer/members/${ids.member}?period=week`).set(auth('trainer'));
      expect(ok.status).toBe(200);
      expect(ok.body.summary.totalWorkouts).toBe(3);
      expectError(await http.get(`/api/v1/reports/trainer/members/${ids.empty}`).set(auth('trainer')), 403);
      expectError(await http.get(`/api/v1/reports/trainer/members/${ids.member}`).set(auth('trainer2')), 403);
      expectError(await http.get(`/api/v1/reports/trainer/members/${ids.member}`).set(auth('member')), 403);
    });

    it('role restrictions on every report', async () => {
      expectError(await http.get('/api/v1/reports/member'), 401);
      expectError(await http.get('/api/v1/reports/member').set(auth('trainer')), 403);
      expectError(await http.get('/api/v1/reports/trainer').set(auth('member')), 403);
      expectError(await http.get('/api/v1/reports/admin').set(auth('member')), 403);
      expectError(await http.get('/api/v1/reports/admin').set(auth('trainer')), 403);
    });

    it('admin report matches the database', async () => {
      const res = await http.get('/api/v1/reports/admin?period=week').set(auth('admin'));
      expect(res.status).toBe(200);
      const [[{ n: users }]] = [await db.query('SELECT COUNT(*) AS n FROM Users')];
      const [[{ n: logs }]] = [await db.query('SELECT COUNT(*) AS n FROM WorkoutLogs WHERE WorkoutDate BETWEEN ? AND ?', [daysFromToday(-6), d0])];
      expect(res.body.users.total).toBe(Number(users));
      expect(res.body.activity.totalWorkouts).toBe(Number(logs));
      expect(res.body.users.byRole.map((r: { role: string }) => r.role)).toEqual(['Member', 'Trainer', 'Admin']);
      expect(res.body.seriesGranularity).toBe('day');
      expect(res.body.activity.series).toHaveLength(7);
      expect(res.body.topExercises.length).toBeGreaterThan(0);
      expect(res.body.assignments.trainers.some((t: { trainerId: number }) => t.trainerId === ids.trainer)).toBe(true);
      expect(res.body.usage.exercisesImported).toBeGreaterThanOrEqual(1);

      const yearly = await http.get(`/api/v1/reports/admin?from=${daysFromToday(-200)}&to=${d0}`).set(auth('admin'));
      expect(yearly.body.seriesGranularity).toBe('month');
    });

    it('exports CSV safely (formula injection neutralised)', async () => {
      const evil = await http
        .post('/api/v1/exercises')
        .set(auth('admin'))
        .send({ exerciseName: '=HYPERLINK("http://evil.example","x")', category: '+cmd' });
      await http
        .post('/api/v1/workout-logs')
        .set(auth('csv'))
        .send({ exerciseId: evil.body.exerciseId, workoutDate: d0, sets: 1, repetitions: 1, durationMinutes: 1 });
      await http.post('/api/v1/progress-records').set(auth('csv')).send({ recordDate: d2, weightKg: 70, notes: '@SUM(A1:A9)' });
      await http.post('/api/v1/progress-records').set(auth('csv')).send({ recordDate: d0, weightKg: 69.5 });

      const res = await http.get('/api/v1/reports/member?period=week&format=csv').set(auth('csv'));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="fitsync-member-report-.+\.csv"$/);
      const csv = res.text;
      expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
      expect(csv).toContain(`"'+cmd"`);
      expect(csv).toContain(`"'@SUM(A1:A9)"`);
      // No cell starts with a formula character.
      const cells = csv.replace(/^﻿/, '').split(/\r\n/).flatMap((line) => line.match(/("([^"]|"")*"|[^,]*)/g) ?? []);
      expect(cells.some((c) => /^"?[=+@]/.test(c))).toBe(false);
      // Numbers stay numeric (weight change −0.5 is not turned into text).
      expect(csv).toMatch(/,-0\.5,/);
      // Human-readable labels with units and ISO dates, no internal property names.
      expect(csv).toContain('"Training time (minutes)",');
      expect(csv).toContain('"Repetitions (sets x reps per set)",');
      expect(csv).toMatch(/"Generated","\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC"/);
      expect(csv).not.toMatch(/totalDurationMinutes|consistencyPercent|longestStreakDays/);

      for (const path of ['/api/v1/reports/admin?format=csv', '/api/v1/reports/trainer?format=csv']) {
        const who = path.includes('admin') ? 'admin' : 'trainer';
        const other = await http.get(path).set(auth(who));
        expect(other.status).toBe(200);
        expect(other.headers['content-type']).toMatch(/^text\/csv/);
      }
    });
  });
});
