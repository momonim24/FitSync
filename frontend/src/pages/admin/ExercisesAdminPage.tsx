import { Dumbbell, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { exercisesApi } from '../../api/services';
import type { Exercise } from '../../api/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  IconButton,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Table,
  Td,
  TextAreaField,
  TextField,
  Th,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';

/** Admin: manage the exercise catalog (POST / PUT / DELETE /exercises). */
export default function ExercisesAdminPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const categories = useFetch(() => exercisesApi.categories(), []);
  const { data, loading, error, reload } = useFetch(() => exercisesApi.list({ search: debounced, category, page, limit: 12 }), [debounced, category, page]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadAll = () => {
    reload();
    categories.reload();
  };

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await exercisesApi.remove(deleting.exerciseId);
      toast.success(`${deleting.exerciseName} deleted.`);
      setDeleting(null);
      reloadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Exercise Management"
        description="Maintain the catalog members log and trainers add to plans."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add exercise
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_220px]">
          <label className="relative">
            <span className="sr-only">Search exercises</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input className="field pl-10" placeholder="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Filter by category</span>
            <select className="field" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading exercises…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No exercises found" icon={Dumbbell} />
        ) : data ? (
          <>
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                head={
                  <>
                    <Th className="w-16">ID</Th>
                    <Th>Exercise</Th>
                    <Th>Category</Th>
                    <Th>Description</Th>
                    <Th className="w-28 text-right">Actions</Th>
                  </>
                }
              >
                {data.items.map((exercise) => (
                  <tr key={exercise.exerciseId} className="hover:bg-raised/50">
                    <Td className="tabular-nums text-faint">{exercise.exerciseId}</Td>
                    <Td className="font-medium text-ink">
                      {exercise.exerciseName}
                      {exercise.source && (
                        <span
                          className="ml-2 align-middle"
                          title={`Imported from wger.de${exercise.source.author ? ` · by ${exercise.source.author}` : ''}${exercise.source.license ? ` · ${exercise.source.license}` : ''}`}
                        >
                          <Badge tone="info">wger</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone="lime">{exercise.category}</Badge>
                    </Td>
                    <Td className="max-w-sm truncate text-muted">{exercise.description || '—'}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <IconButton
                        icon={Pencil}
                        label={`Edit ${exercise.exerciseName}`}
                        onClick={() => {
                          setEditing(exercise);
                          setFormOpen(true);
                        }}
                      />
                      <IconButton icon={Trash2} label={`Delete ${exercise.exerciseName}`} className="hover:text-danger" onClick={() => setDeleting(exercise)} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>

      <ExerciseFormModal open={formOpen} exercise={editing} categories={categories.data ?? []} onClose={() => setFormOpen(false)} onSaved={reloadAll} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete exercise?"
        message={
          <>
            <strong className="text-ink">{deleting?.exerciseName}</strong> will be removed from the catalog. Exercises already used in workout logs or plans cannot be deleted.
          </>
        }
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function ExerciseFormModal({ open, exercise, categories, onClose, onSaved }: { open: boolean; exercise: Exercise | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ exerciseName: '', category: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'exerciseName' | 'category' | 'description'>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    setForm({ exerciseName: exercise?.exerciseName ?? '', category: exercise?.category ?? '', description: exercise?.description ?? '' });
    setError(null);
    setErrors({});
  }, [open, exercise]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      exerciseName: v.requiredText(form.exerciseName, 'Exercise name'),
      category: v.requiredText(form.category, 'Category'),
      description: v.optionalText(form.description, 'Description', v.LIMITS.description),
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    const payload = { exerciseName: form.exerciseName.trim(), category: form.category.trim(), description: form.description.trim() || null };
    void run(async () => {
      setError(null);
      try {
        if (exercise) await exercisesApi.replace(exercise.exerciseId, payload);
        else await exercisesApi.create(payload);
        toast.success(exercise ? 'Exercise updated.' : 'Exercise added.');
        onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'Add exercise'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="exercise-form" loading={saving}>
            {exercise ? 'Save changes' : 'Add exercise'}
          </Button>
        </>
      }
    >
      <form id="exercise-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <TextField label="Exercise name" value={form.exerciseName} maxLength={v.LIMITS.name} error={errors.exerciseName} onChange={(e) => setForm({ ...form, exerciseName: e.target.value })} />
        <TextField label="Category" list="exercise-categories" value={form.category} maxLength={v.LIMITS.name} error={errors.category} placeholder="e.g. Strength" onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <datalist id="exercise-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextAreaField label="Description (optional)" className="sm:col-span-2" maxLength={v.LIMITS.description} error={errors.description} hint={`${form.description.length} / ${v.LIMITS.description}`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
    </Modal>
  );
}
