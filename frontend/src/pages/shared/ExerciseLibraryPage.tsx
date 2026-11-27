import { CheckCircle2, CloudOff, Dumbbell, ExternalLink, Globe, ImageOff, PackagePlus, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { exercisesApi, externalApi } from '../../api/services';
import type { ExternalExercise } from '../../api/types';
import { Badge, Button, EmptyState, LoadingState, Modal, PageHeader, Pagination } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';

/**
 * External Exercise Library — browses the public wger exercise database
 * through the FitSync API (/external-fitness). Every role can browse;
 * administrators can import an exercise into the local catalog.
 * If wger is unreachable, the local catalog is shown instead.
 */
export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [equipment, setEquipment] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ExternalExercise | null>(null);
  const [importing, setImporting] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const term = search.trim();
      setDebounced(term.length >= 2 ? term : '');
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const categories = useFetch(() => externalApi.categories(), []);
  const equipmentList = useFetch(() => externalApi.equipment(), []);
  const { data, loading, error, reload, setData } = useFetch(
    () => externalApi.list({ search: debounced, category, equipment, page, limit: 12 }),
    [debounced, category, equipment, page],
  );

  async function importExercise(exercise: ExternalExercise) {
    setImporting(exercise.externalId);
    try {
      const local = await externalApi.importExercise(exercise.externalId);
      toast.success(`"${local.exerciseName}" was added to the local exercise catalog.`);
      const mark = (e: ExternalExercise) => (e.externalId === exercise.externalId ? { ...e, localExerciseId: local.exerciseId } : e);
      setData((prev) => (prev ? { ...prev, items: prev.items.map(mark) } : prev));
      setSelected((prev) => (prev ? mark(prev) : prev));
      // Re-fetch so a list request that was still in flight cannot overwrite the new state.
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(null);
    }
  }

  const filtersDisabled = Boolean(categories.error);

  return (
    <>
      <PageHeader
        title="Exercise Library"
        description={
          isAdmin
            ? 'Browse the public wger exercise database and import exercises into the FitSync catalog.'
            : 'Browse hundreds of exercises from the public wger exercise database.'
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_190px_190px]">
        <label className="relative">
          <span className="sr-only">Search the exercise library</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input className="field pl-10" placeholder="Search exercises (2+ letters)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select className="field" value={category} disabled={filtersDisabled} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by equipment</span>
          <select className="field" value={equipment} disabled={Boolean(equipmentList.error)} onChange={(e) => (setEquipment(e.target.value), setPage(1))}>
            <option value="">All equipment</option>
            {(equipmentList.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data?.cache === 'STALE' && (
        <p role="status" className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          wger is currently unreachable — showing the most recent results FitSync received from it.
        </p>
      )}

      {loading && !data ? (
        <LoadingState label="Loading exercises from wger…" />
      ) : error ? (
        <LocalFallback message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No exercises found" description="Try another search term, category or equipment filter." icon={Globe} />
        </div>
      ) : data ? (
        <div className="card overflow-hidden">
          <ul className={`grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((exercise) => (
              <li key={exercise.externalId} className="flex flex-col bg-surface">
                <button
                  onClick={() => setSelected(exercise)}
                  className="group flex flex-1 flex-col text-left focus-visible:outline-offset-[-2px]"
                  aria-label={`View details for ${exercise.name}`}
                >
                  <ExerciseImage exercise={exercise} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-ink group-hover:text-lime">{exercise.name}</h2>
                      {exercise.category && <Badge tone="lime">{exercise.category.name}</Badge>}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted">{exercise.description || 'No description provided.'}</p>
                    <dl className="mt-3 space-y-1 text-xs text-faint">
                      {exercise.muscles.length > 0 && (
                        <div>
                          <dt className="inline">Muscles: </dt>
                          <dd className="inline text-muted">{exercise.muscles.join(', ')}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">Equipment: </dt>
                        <dd className="inline text-muted">{exercise.equipment.length ? exercise.equipment.join(', ') : 'None listed'}</dd>
                      </div>
                    </dl>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-faint">
                  <span className="truncate">{exercise.attribution.license ?? 'Licence not stated'}</span>
                  <ImportControl exercise={exercise} isAdmin={isAdmin} busy={importing === exercise.externalId} onImport={importExercise} compact />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </div>
      ) : null}

      <p className="mt-4 text-xs text-faint">
        Exercise data and images from{' '}
        <a href="https://wger.de" target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
          wger.de
        </a>
        , published under Creative Commons licences. Each exercise lists its own licence and author.
      </p>

      <ExerciseDetailModal exercise={selected} isAdmin={isAdmin} busy={importing === selected?.externalId} onImport={importExercise} onClose={() => setSelected(null)} />
    </>
  );
}

function ExerciseImage({ exercise }: { exercise: ExternalExercise }) {
  const image = exercise.images[0];
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center bg-raised text-faint" aria-hidden>
        <ImageOff className="size-6" />
      </div>
    );
  }
  return (
    <div className="aspect-[16/9] bg-white">
      <img
        src={image.thumbnailUrl}
        alt={`${exercise.name} illustration`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-full object-contain"
      />
    </div>
  );
}

function ImportControl({
  exercise,
  isAdmin,
  busy,
  onImport,
  compact = false,
}: {
  exercise: ExternalExercise;
  isAdmin: boolean;
  busy: boolean;
  onImport: (e: ExternalExercise) => void;
  compact?: boolean;
}) {
  if (exercise.localExerciseId) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-lime">
        <CheckCircle2 className="size-3.5" aria-hidden /> In local catalog
      </span>
    );
  }
  if (!isAdmin) return null;
  return (
    <Button size="sm" variant={compact ? 'secondary' : 'primary'} icon={PackagePlus} loading={busy} onClick={() => onImport(exercise)} aria-label={`Import ${exercise.name}`}>
      Import
    </Button>
  );
}

function ExerciseDetailModal({
  exercise,
  isAdmin,
  busy,
  onImport,
  onClose,
}: {
  exercise: ExternalExercise | null;
  isAdmin: boolean;
  busy: boolean;
  onImport: (e: ExternalExercise) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(exercise)}
      onClose={onClose}
      title={exercise?.name ?? ''}
      size="lg"
      footer={
        exercise && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <ImportControl exercise={exercise} isAdmin={isAdmin} busy={busy} onImport={onImport} />
          </>
        )
      }
    >
      {exercise && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2">
            {exercise.category && <Badge tone="lime">{exercise.category.name}</Badge>}
            {exercise.equipment.map((e) => (
              <Badge key={e}>{e}</Badge>
            ))}
          </div>

          {exercise.images.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {exercise.images.slice(0, 4).map((image) => (
                <figure key={image.url} className="overflow-hidden rounded-xl border border-line">
                  <div className="bg-white">
                    <img src={image.thumbnailUrl} alt={`${exercise.name} illustration`} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full object-contain" />
                  </div>
                  <figcaption className="px-3 py-2 text-xs text-faint">
                    Image: {image.author ?? 'unknown author'} ·{' '}
                    {image.licenseUrl ? (
                      <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
                        {image.license}
                      </a>
                    ) : (
                      image.license
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Instructions</h3>
            <p className="whitespace-pre-line leading-relaxed text-muted">{exercise.description || 'No description provided by wger.'}</p>
          </section>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-faint">Primary muscles</dt>
              <dd className="mt-1 text-ink">{exercise.muscles.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-faint">Secondary muscles</dt>
              <dd className="mt-1 text-ink">{exercise.secondaryMuscles.join(', ') || '—'}</dd>
            </div>
          </dl>

          <section className="rounded-xl border border-line bg-raised px-4 py-3 text-xs text-muted">
            <h3 className="mb-1 font-semibold text-ink">Source &amp; licence</h3>
            <p>
              {exercise.attribution.text}.{' '}
              {exercise.attribution.licenseUrl && (
                <a href={exercise.attribution.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
                  Licence terms
                </a>
              )}
            </p>
            <a href={exercise.attribution.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-lime hover:underline">
              View on wger.de <ExternalLink className="size-3" aria-hidden />
            </a>
            {exercise.language !== 'en' && <p className="mt-1.5 text-warning">No English translation is available; showing another language.</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}

/** Shown when wger cannot be reached: explains the error and lists the local catalog instead. */
function LocalFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const local = useFetch(() => exercisesApi.list({ limit: 12 }), []);
  return (
    <div className="space-y-5">
      <div role="alert" className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <CloudOff className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-medium text-ink">The external exercise library is unavailable</p>
            <p className="mt-0.5 text-sm text-muted">{message} Below is the FitSync local exercise catalog instead.</p>
          </div>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      </div>
      <section className="card overflow-hidden">
        <header className="border-b border-line px-5 py-3.5 text-sm font-semibold">Local exercise catalog</header>
        {local.loading ? (
          <LoadingState />
        ) : local.error ? (
          <p className="p-5 text-sm text-danger">{local.error}</p>
        ) : !local.data?.items.length ? (
          <EmptyState title="No local exercises" icon={Dumbbell} />
        ) : (
          <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {local.data.items.map((e) => (
              <li key={e.exerciseId} className="bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{e.exerciseName}</h3>
                  <Badge tone="lime">{e.category}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{e.description || 'No description provided.'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
