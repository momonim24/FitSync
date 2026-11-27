import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { conflict } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExternalExerciseQueryDto } from './dto/external-exercise.dto';
import { htmlToText, truncate } from './html-to-text';
import { CacheStatus, upstreamError, WgerClient, WGER_TRUSTED_ORIGIN } from './wger.client';

export const PROVIDER = 'wger';
const ENGLISH_LANGUAGE_ID = 2; // GET /api/v2/language/ → { id: 2, short_name: "en" }

/** Normalized FitSync representation of an external exercise. */
export interface ExternalExercise {
  externalId: number;
  provider: typeof PROVIDER;
  name: string;
  language: 'en' | 'other';
  category: { id: number; name: string } | null;
  description: string;
  muscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  images: ExternalImage[];
  attribution: {
    sourceUrl: string;
    license: string | null;
    licenseUrl: string | null;
    author: string | null;
    text: string;
  };
  /** Local ExerciseID if an admin already imported this exercise, else null. */
  localExerciseId: number | null;
}

export interface ExternalImage {
  url: string;
  thumbnailUrl: string;
  isMain: boolean;
  license: string;
  licenseUrl: string | null;
  author: string | null;
  authorUrl: string | null;
  sourceUrl: string | null;
}

export interface Named {
  id: number;
  name: string;
}

interface License {
  id: number;
  shortName: string;
  url: string | null;
}

// ---------------------------------------------------------------- helpers
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Accept only https links on the provider's own origin (or well-known licence hosts for licences). */
function trustedUrl(v: unknown, origins: string[] = [WGER_TRUSTED_ORIGIN]): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && origins.includes(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}
const LICENSE_ORIGINS = ['https://creativecommons.org', 'https://opendatacommons.org'];

const malformed = (detail: string) =>
  upstreamError(HttpStatus.BAD_GATEWAY, 'Invalid response from external fitness service.', detail);

/**
 * Browses the wger exercise database and imports selected exercises into the
 * local catalog. Workout logs and plans keep using local Exercises rows only,
 * so foreign keys stay valid even if wger changes or is offline.
 */
@Injectable()
export class ExternalFitnessService {
  constructor(
    private readonly wger: WgerClient,
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
  ) {}

  async list(query: ExternalExerciseQueryDto): Promise<Paginated<ExternalExercise> & { cache: CacheStatus }> {
    const [{ data, cache }, licenses] = await Promise.all([
      this.wger.get('/exerciseinfo/', {
        language__code: 'en',
        name__search: query.search,
        category: query.category,
        equipment: query.equipment,
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      }),
      this.licenses(),
    ]);
    if (!isObject(data) || !Array.isArray(data.results) || int(data.count) === null) {
      throw malformed('Expected a paginated list with "count" and "results".');
    }
    const items = data.results.map((raw) => this.normalize(raw, licenses)).filter((e): e is ExternalExercise => e !== null);
    await this.markImported(items);
    return { items, total: data.count as number, page: query.page, limit: query.limit, cache };
  }

  async findOne(id: number): Promise<{ item: ExternalExercise; cache: CacheStatus }> {
    const [{ data, cache }, licenses] = await Promise.all([this.wger.get(`/exerciseinfo/${id}/`), this.licenses()]);
    const item = this.normalize(data, licenses);
    if (!item) throw malformed('The exercise record is missing its ID or name.');
    await this.markImported([item]);
    return { item, cache };
  }

  async categories(): Promise<Named[]> {
    return this.namedList('/exercisecategory/');
  }

  async equipment(): Promise<Named[]> {
    return this.namedList('/equipment/');
  }

  /**
   * Copies one external exercise into the local Exercises table, keeping its
   * licence attribution. 409 if it was already imported or a local exercise
   * with the same name exists.
   */
  async importExercise(id: number): Promise<Exercise> {
    const existing = await this.exercises.findOne({ where: { externalSource: PROVIDER, externalId: id } });
    if (existing) {
      throw conflict('Exercise already imported.', `This wger exercise is already in the local catalog as exercise #${existing.exerciseId}.`);
    }

    const { item } = await this.findOne(id);
    const name = truncate(item.name, 100);
    const sameName = await this.exercises
      .createQueryBuilder('e')
      .where('LOWER(e.exerciseName) = LOWER(:name)', { name })
      .getOne();
    if (sameName) {
      throw conflict('Exercise already exists.', `A local exercise named "${sameName.exerciseName}" already exists (exercise #${sameName.exerciseId}).`);
    }

    const saved = await this.exercises.save(
      this.exercises.create({
        exerciseName: name,
        category: truncate(item.category?.name ?? 'General', 100),
        description: item.description ? truncate(item.description, 255) : null,
        externalSource: PROVIDER,
        externalId: item.externalId,
        sourceUrl: item.attribution.sourceUrl,
        licenseName: item.attribution.license ? truncate(item.attribution.license, 100) : null,
        licenseUrl: item.attribution.licenseUrl,
        licenseAuthor: item.attribution.author ? truncate(item.attribution.author, 255) : null,
        importedAt: new Date(),
      }),
    );
    return saved;
  }

  // ---------------------------------------------------------------- internals

  /** Licence list (cached 24 h). On failure images are hidden, never shown unlicensed. */
  private async licenses(): Promise<Map<number, License>> {
    try {
      const { data } = await this.wger.get('/license/', { limit: 100 }, 24 * 60 * 60 * 1000);
      const map = new Map<number, License>();
      for (const raw of isObject(data) ? arr(data.results) : []) {
        if (!isObject(raw)) continue;
        const id = int(raw.id);
        const shortName = str(raw.short_name);
        if (id !== null && shortName) map.set(id, { id, shortName, url: trustedUrl(raw.url, LICENSE_ORIGINS) });
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private async namedList(path: string): Promise<Named[]> {
    const { data } = await this.wger.get(path, { limit: 100 }, 24 * 60 * 60 * 1000);
    if (!isObject(data) || !Array.isArray(data.results)) throw malformed('Expected a list with "results".');
    return data.results
      .map((raw) => (isObject(raw) && int(raw.id) !== null && str(raw.name) ? { id: raw.id as number, name: str(raw.name)! } : null))
      .filter((x): x is Named => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Maps one wger /exerciseinfo/ record to ExternalExercise; null if unusable. */
  private normalize(raw: unknown, licenses: Map<number, License>): ExternalExercise | null {
    if (!isObject(raw)) return null;
    const externalId = int(raw.id);
    if (externalId === null) return null;

    const translations = arr(raw.translations).filter(isObject);
    const english = translations.find((t) => t.language === ENGLISH_LANGUAGE_ID && str(t.name));
    const translation = english ?? translations.find((t) => str(t.name));
    if (!translation) return null;

    const category = isObject(raw.category) && int(raw.category.id) !== null && str(raw.category.name)
      ? { id: raw.category.id as number, name: str(raw.category.name)! }
      : null;
    const muscleNames = (list: unknown) =>
      arr(list).filter(isObject).map((m) => str(m.name_en) ?? str(m.name)).filter((n): n is string => !!n);
    const license = isObject(raw.license) ? raw.license : {};
    const licenseName = str(license.short_name) ?? str(license.full_name);
    const author = str(translation.license_author) ?? str(raw.license_author);
    const name = str(translation.name)!;

    return {
      externalId,
      provider: PROVIDER,
      name,
      language: english ? 'en' : 'other',
      category,
      description: htmlToText(translation.description),
      muscles: muscleNames(raw.muscles),
      secondaryMuscles: muscleNames(raw.muscles_secondary),
      equipment: arr(raw.equipment).filter(isObject).map((e) => str(e.name)).filter((n): n is string => !!n),
      images: this.images(raw.images, licenses),
      attribution: {
        sourceUrl: `${WGER_TRUSTED_ORIGIN}/en/exercise/${externalId}/view/`,
        license: licenseName,
        licenseUrl: trustedUrl(license.url, LICENSE_ORIGINS),
        author,
        text: `"${name}" by ${author ?? 'wger contributors'}, from wger.de` + (licenseName ? `, licensed under ${licenseName}` : ''),
      },
      localExerciseId: null,
    };
  }

  /** Keeps only images on wger's own host whose licence is a known Creative Commons licence. */
  private images(raw: unknown, licenses: Map<number, License>): ExternalImage[] {
    return arr(raw)
      .filter(isObject)
      .map((img): ExternalImage | null => {
        const license = licenses.get(int(img.license) ?? -1);
        const url = trustedUrl(img.image);
        if (!license || !/^CC/i.test(license.shortName) || !url) return null;
        const thumbs = isObject(img.thumbnails) ? img.thumbnails : {};
        return {
          url,
          thumbnailUrl: trustedUrl(thumbs.medium) ?? trustedUrl(thumbs.small) ?? url,
          isMain: img.is_main === true,
          license: license.shortName,
          licenseUrl: license.url,
          author: str(img.license_author),
          authorUrl: trustedUrl(img.license_author_url, [WGER_TRUSTED_ORIGIN, 'https://github.com']),
          sourceUrl: trustedUrl(img.license_object_url, [WGER_TRUSTED_ORIGIN]),
        };
      })
      .filter((x): x is ExternalImage => x !== null)
      .sort((a, b) => Number(b.isMain) - Number(a.isMain));
  }

  private async markImported(items: ExternalExercise[]): Promise<void> {
    if (items.length === 0) return;
    const rows = await this.exercises.find({
      where: { externalSource: PROVIDER, externalId: In(items.map((i) => i.externalId)) },
      select: { exerciseId: true, externalId: true },
    });
    const byExternal = new Map(rows.map((r) => [r.externalId, r.exerciseId]));
    for (const item of items) item.localExerciseId = byExternal.get(item.externalId) ?? null;
  }
}
