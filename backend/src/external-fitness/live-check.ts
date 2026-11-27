/**
 * Live integration check against the real wger API (network required).
 *
 *   npm run check:wger
 *
 * Kept separate from the automated test suites, which use mocked responses so
 * they are deterministic and work offline. This script calls the real
 * provider through the same WgerClient + ExternalFitnessService used by the
 * API and verifies the normalized output. It never writes to any database.
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExternalFitnessService } from './external-fitness.service';
import { WgerClient, WGER_API_BASE } from './wger.client';

// Read-only stand-in for the Exercises repository: nothing is imported here.
const noDatabase = { find: async () => [] } as unknown as Repository<Exercise>;

async function main() {
  const service = new ExternalFitnessService(new WgerClient(new ConfigService(process.env)), noDatabase);
  const results: Array<[string, boolean, string]> = [];
  const check = (name: string, ok: boolean, detail: string) => results.push([name, ok, detail]);
  const started = Date.now();

  const categories = await service.categories();
  check('categories', categories.length > 0, `${categories.length} categories (${categories.map((c) => c.name).join(', ')})`);

  const equipment = await service.equipment();
  check('equipment', equipment.length > 0, `${equipment.length} equipment types`);

  const page1 = await service.list({ page: 1, limit: 5 });
  check('browse page 1', page1.items.length > 0 && page1.total > 0, `${page1.total} English exercises available; got ${page1.items.length}`);
  check('english names', page1.items.every((e) => e.language === 'en' && e.name.length > 0), page1.items.map((e) => e.name).join(' | '));

  const page2 = await service.list({ page: 2, limit: 5 });
  const overlap = page2.items.filter((e) => page1.items.some((p) => p.externalId === e.externalId));
  check('pagination', page2.items.length > 0 && overlap.length === 0, `page 2: ${page2.items.map((e) => e.externalId).join(', ')}`);

  const search = await service.list({ search: 'squat', page: 1, limit: 5 });
  check('search "squat"', search.items.some((e) => /squat/i.test(e.name)), `${search.total} matches: ${search.items.map((e) => e.name).join(' | ')}`);

  const chest = categories.find((c) => c.name === 'Chest');
  if (chest) {
    const filtered = await service.list({ category: chest.id, page: 1, limit: 5 });
    check('category filter', filtered.items.every((e) => e.category?.id === chest.id), `${filtered.total} chest exercises`);
  }

  const detail = await service.findOne(73);
  check('detail #73', detail.item.name.length > 0, `${detail.item.name}; ${detail.item.muscles.join(', ')}; ${detail.item.equipment.join(', ')}`);
  check('attribution', !!detail.item.attribution.license && detail.item.attribution.sourceUrl.startsWith('https://wger.de/'), detail.item.attribution.text);
  check('description is plain text', !/[<>]/.test(detail.item.description), detail.item.description.slice(0, 80) + '…');
  check(
    'images licensed + trusted host',
    detail.item.images.every((i) => /^CC/.test(i.license) && i.url.startsWith('https://wger.de/media/')),
    `${detail.item.images.length} image(s): ${detail.item.images.map((i) => `${i.license} by ${i.author}`).join('; ')}`,
  );

  const again = await service.list({ page: 1, limit: 5 });
  check('cache', again.cache === 'HIT', `second identical request served from ${again.cache}`);

  console.log(`Live check against ${WGER_API_BASE} (${new Date().toISOString()})\n`);
  for (const [name, ok, detailText] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(32)} ${detailText}`);
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed in ${Date.now() - started} ms`);
  process.exit(failed ? 1 : 0);
}

main().catch((error: Error & { response?: unknown }) => {
  console.error('Live check failed:', error.message, error.response ? JSON.stringify(error.response) : '');
  process.exit(1);
});
