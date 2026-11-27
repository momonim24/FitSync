import { Activity, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { logsApi } from '../../api/services';
import type { WorkoutLog } from '../../api/types';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, IconButton, LoadingState, PageHeader, Pagination, Table, Td, Th } from '../../components/ui';
import { WorkoutLogModal } from '../../components/WorkoutLogModal';
import { useToast } from '../../context/ToastContext';
import { useExerciseOptions } from '../../hooks/useExerciseOptions';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/format';

/** Member: record, view, update and delete own workout logs. */
export default function WorkoutLogsPage() {
  const toast = useToast();
  const { exercises } = useExerciseOptions();
  const [filters, setFilters] = useState({ exerciseId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WorkoutLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkoutLog | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, loading, error, reload } = useFetch(
    () => logsApi.list({ ...filters, page, limit: 15 }),
    [filters.exerciseId, filters.from, filters.to, page],
  );

  const updateFilter = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await logsApi.remove(deleting.logId);
      toast.success('Workout deleted.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  const hasFilters = Boolean(filters.exerciseId || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Workout Logs"
        description="Your complete workout history."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Record workout
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label>
            <span className="label">Exercise</span>
            <select className="field" value={filters.exerciseId} onChange={updateFilter('exerciseId')}>
              <option value="">All exercises</option>
              {exercises.map((e) => (
                <option key={e.exerciseId} value={e.exerciseId}>
                  {e.exerciseName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">From</span>
            <input type="date" className="field" value={filters.from} onChange={updateFilter('from')} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="field" value={filters.to} onChange={updateFilter('to')} />
          </label>
          <Button variant="ghost" disabled={!hasFilters} onClick={() => setFilters({ exerciseId: '', from: '', to: '' })}>
            Clear
          </Button>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading workouts…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No workouts match these filters' : 'No workouts recorded yet'}
            description={hasFilters ? 'Try widening the date range.' : 'Record your first workout to start building your history.'}
            icon={Activity}
          />
        ) : data ? (
          <>
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                head={
                  <>
                    <Th>Date</Th>
                    <Th>Exercise</Th>
                    <Th className="text-right">Sets</Th>
                    <Th className="text-right">Reps</Th>
                    <Th className="text-right">Duration</Th>
                    <Th className="w-28 text-right">Actions</Th>
                  </>
                }
              >
                {data.items.map((log) => (
                  <tr key={log.logId} className="hover:bg-raised/50">
                    <Td className="whitespace-nowrap text-muted">{formatDate(log.workoutDate)}</Td>
                    <Td>
                      <span className="font-medium text-ink">{log.exercise?.exerciseName}</span>{' '}
                      <span className="ml-1">
                        <Badge>{log.exercise?.category}</Badge>
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{log.sets}</Td>
                    <Td className="text-right tabular-nums">{log.repetitions}</Td>
                    <Td className="text-right tabular-nums">{log.durationMinutes} min</Td>
                    <Td className="whitespace-nowrap text-right">
                      <IconButton
                        icon={Pencil}
                        label={`Edit ${log.exercise?.exerciseName} on ${log.workoutDate}`}
                        onClick={() => {
                          setEditing(log);
                          setModalOpen(true);
                        }}
                      />
                      <IconButton icon={Trash2} label={`Delete ${log.exercise?.exerciseName} on ${log.workoutDate}`} className="hover:text-danger" onClick={() => setDeleting(log)} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>

      <WorkoutLogModal open={modalOpen} log={editing} onClose={() => setModalOpen(false)} onSaved={() => reload()} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete workout?"
        message={
          <>
            This permanently removes <strong className="text-ink">{deleting?.exercise?.exerciseName}</strong> on {formatDate(deleting?.workoutDate)} from your history.
          </>
        }
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
