import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExternalFitnessService } from './external-fitness.service';
import { WgerClient, WGER_API_BASE } from './wger.client';
import { wgerFixtures } from '../../test/fixtures/wger.fixtures';

/** Builds a fetch mock that answers by URL path, like the real wger API. */
function mockFetch(routes: Record<string, () => Promise<Response> | Response>) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const handler = routes[url.pathname];
    if (!handler) return new Response('{"detail":"Not found."}', { status: 404 });
    return handler();
  });
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ExternalFitnessService (mocked wger)', () => {
  let service: ExternalFitnessService;
  let client: WgerClient;
  const repo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ exerciseId: 99, ...x })),
    createQueryBuilder: jest.fn(() => ({ where: () => ({ getOne: async () => null }) })),
  } as unknown as Repository<Exercise>;

  beforeEach(() => {
    jest.restoreAllMocks();
    const config = { get: (key: string, fallback: unknown) => ({ WGER_TIMEOUT_MS: 50, WGER_CACHE_TTL_SECONDS: 600 } as Record<string, unknown>)[key] ?? fallback } as ConfigService;
    client = new WgerClient(config);
    service = new ExternalFitnessService(client, repo);
  });

  const okRoutes = {
    '/api/v2/exerciseinfo/': () => json(wgerFixtures.list),
    '/api/v2/exerciseinfo/73/': () => json(wgerFixtures.list.results[0]),
    '/api/v2/license/': () => json(wgerFixtures.licenses),
    '/api/v2/exercisecategory/': () => json(wgerFixtures.categories),
  };

  it('normalizes a successful response into the FitSync format', async () => {
    mockFetch(okRoutes);
    const result = await service.list({ page: 1, limit: 12 });
    expect(result.total).toBe(2);
    const bench = result.items[0];
    expect(bench).toMatchObject({
      externalId: 73,
      provider: 'wger',
      name: 'Bench Press', // English translation preferred over the German one
      language: 'en',
      category: { id: 11, name: 'Chest' },
      muscles: ['Chest'],
      secondaryMuscles: ['Triceps'],
      equipment: ['Barbell', 'Bench'],
      attribution: {
        sourceUrl: 'https://wger.de/en/exercise/73/view/',
        license: 'CC-BY-SA 3',
        author: 'Everkinetic',
      },
      localExerciseId: null,
    });
    expect(bench.description).toBe('Lie on a bench.\n\n• Lower the bar\n• Press up');
  });

  it('only keeps images on wger with a Creative Commons licence', async () => {
    mockFetch(okRoutes);
    const { items } = await service.list({ page: 1, limit: 12 });
    // Fixture has 3 images: CC-BY-SA licensed, ODbL licensed, and one on a foreign host.
    expect(items[0].images).toHaveLength(1);
    expect(items[0].images[0]).toMatchObject({ license: 'CC-BY-SA 4', author: 'Everkinetic', isMain: true });
    expect(items[0].images[0].url.startsWith('https://wger.de/media/')).toBe(true);
  });

  it('hides all images if the licence list cannot be loaded (fail closed)', async () => {
    mockFetch({ ...okRoutes, '/api/v2/license/': () => json({ unexpected: true }) });
    const { items } = await service.list({ page: 1, limit: 12 });
    expect(items[0].images).toEqual([]);
  });

  it('maps search, filters and pagination to wger query parameters', async () => {
    const spy = mockFetch(okRoutes);
    await service.list({ search: 'press', category: 11, equipment: 1, page: 3, limit: 10 });
    const listCall = spy.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === '/api/v2/exerciseinfo/')!;
    expect(listCall.origin + '/api/v2').toBe(WGER_API_BASE);
    expect(Object.fromEntries(listCall.searchParams)).toEqual({
      category: '11',
      equipment: '1',
      language__code: 'en',
      limit: '10',
      name__search: 'press',
      offset: '20',
    });
  });

  it('sends no credentials or user data to the provider', async () => {
    const spy = mockFetch(okRoutes);
    await service.list({ page: 1, limit: 12 });
    for (const [, init] of spy.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBeNull();
      expect(headers.get('cookie')).toBeNull();
      expect([...headers.keys()].sort()).toEqual(['accept', 'user-agent']);
    }
  });

  it('caches responses (second call does not hit the network)', async () => {
    const spy = mockFetch(okRoutes);
    const first = await service.list({ page: 1, limit: 12 });
    const callsAfterFirst = spy.mock.calls.length;
    const second = await service.list({ page: 1, limit: 12 });
    expect(first.cache).toBe('MISS');
    expect(second.cache).toBe('HIT');
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('returns 504 when wger times out', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))),
    );
    await expect(service.list({ page: 1, limit: 12 })).rejects.toMatchObject({ status: 504 });
  });

  it('returns 503 when wger is unreachable or failing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(service.categories()).rejects.toMatchObject({ status: 503 });

    jest.restoreAllMocks();
    client.clearCache();
    mockFetch({ '/api/v2/exercisecategory/': () => json({ detail: 'Server error' }, 500) });
    await expect(service.categories()).rejects.toMatchObject({ status: 503 });
  });

  it('returns 502 for malformed responses and never invents data', async () => {
    mockFetch({ ...okRoutes, '/api/v2/exerciseinfo/': () => json({ results: 'not-a-list' }) });
    const error = await service.list({ page: 1, limit: 12 }).catch((e: HttpException) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(502);

    jest.restoreAllMocks();
    client.clearCache();
    mockFetch({ ...okRoutes, '/api/v2/exerciseinfo/': () => new Response('<html>oops</html>', { status: 200 }) });
    await expect(service.list({ page: 1, limit: 12 })).rejects.toMatchObject({ status: 502 });
  });

  it('skips individual malformed exercises instead of failing the whole page', async () => {
    mockFetch({ ...okRoutes, '/api/v2/exerciseinfo/': () => json({ count: 3, results: [null, { id: 'x' }, wgerFixtures.list.results[0]] }) });
    const { items } = await service.list({ page: 1, limit: 12 });
    expect(items.map((i) => i.externalId)).toEqual([73]);
  });

  it('serves real stale cached data (marked STALE) if wger fails after a successful call', async () => {
    // Cache lifetime 0 s: every entry is immediately stale but still kept as a fallback.
    const config = { get: (key: string, fallback: unknown) => (key === 'WGER_CACHE_TTL_SECONDS' ? 0 : key === 'WGER_TIMEOUT_MS' ? 50 : fallback) } as ConfigService;
    service = new ExternalFitnessService(new WgerClient(config), repo);

    mockFetch(okRoutes);
    expect((await service.list({ page: 1, limit: 12 })).cache).toBe('MISS');

    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const result = await service.list({ page: 1, limit: 12 });
    expect(result.cache).toBe('STALE');
    expect(result.items[0].name).toBe('Bench Press');
  });

  it('maps a missing exercise to 404', async () => {
    mockFetch(okRoutes);
    await expect(service.findOne(123456)).rejects.toMatchObject({ status: 404 });
  });

  it('imports with attribution and refuses duplicates', async () => {
    mockFetch(okRoutes);
    const saved = await service.importExercise(73);
    expect(saved).toMatchObject({
      exerciseName: 'Bench Press',
      category: 'Chest',
      externalSource: 'wger',
      externalId: 73,
      licenseName: 'CC-BY-SA 3',
      licenseAuthor: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/73/view/',
    });
    expect(saved.description!.length).toBeLessThanOrEqual(255);

    (repo.findOne as jest.Mock).mockResolvedValueOnce({ exerciseId: 5 });
    await expect(service.importExercise(73)).rejects.toMatchObject({ status: 409 });
  });
});
