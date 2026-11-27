import { Dumbbell, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exercisesApi } from '../../api/services';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';

/** Browse the exercise catalog (GET /exercises with search, category and pagination). */
export default function ExerciseCatalogPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const categories = useFetch(() => exercisesApi.categories(), []);
  const { data, loading, error, reload } = useFetch(() => exercisesApi.list({ search: debounced, category, page, limit: 12 }), [debounced, category, page]);

  return (
    <>
      <PageHeader title="Exercise Catalog" description="Browse exercises you can log and follow in your plans." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search exercises</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input className="field pl-10" placeholder="Search by name or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">Filter by category</span>
          <select
            className="field"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading exercises…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No exercises found" description="Try a different search or category." icon={Dumbbell} />
        </div>
      ) : data ? (
        <div className="card overflow-hidden">
          <ul className={`grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((exercise) => (
              <li key={exercise.exerciseId} className="bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-raised text-lime">
                    <Dumbbell className="size-5" aria-hidden />
                  </span>
                  <Badge tone="lime">{exercise.category}</Badge>
                </div>
                <h2 className="mt-4 font-semibold text-ink">{exercise.exerciseName}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{exercise.description || 'No description provided.'}</p>
                {exercise.source && (
                  <p className="mt-2 text-xs text-faint">
                    From{' '}
                    {exercise.source.sourceUrl ? (
                      <a href={exercise.source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
                        wger.de
                      </a>
                    ) : (
                      'wger.de'
                    )}
                    {exercise.source.author && ` · by ${exercise.source.author}`}
                    {exercise.source.license && ` · ${exercise.source.license}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </div>
      ) : null}
    </>
  );
}
