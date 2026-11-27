import { ArrowLeft, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { completionsApi, planExercisesApi, plansApi } from '../../api/services';
import { CompletionBadge, PeriodToggle, ProgressBar, percentTone, prescriptionText, samePrescription, type CompletionWindow } from '../../components/fitness';
import type { PlanExercise } from '../../api/types';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  IconButton,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  Table,
  Td,
  TextField,
  Th,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useExerciseOptions } from '../../hooks/useExerciseOptions';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';
import { formatDate, formatDateTime } from '../../lib/format';

/** Trainer: exercise assignment for one plan (POST / PATCH / DELETE /plan-exercises). */
export default function PlanDetailPage() {
  const { planId } = useParams();
  const id = Number(planId);
  const toast = useToast();
  const { exercises } = useExerciseOptions();
  const { data: plan, loading, error, reload } = useFetch(() => plansApi.get(id), [id]);

  const emptyForm = { exerciseId: '', ...DEFAULT_TARGETS };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<'exerciseId' | keyof TargetForm>>({});
  const { submitting: adding, run } = useSubmitGuard();
  const [editing, setEditing] = useState<PlanExercise | null>(null);
  const [removing, setRemoving] = useState<PlanExercise | null>(null);
  const [busy, setBusy] = useState(false);

  const usedIds = new Set(plan?.planExercises?.map((p) => p.exerciseId));
  const available = exercises.filter((e) => !usedIds.has(e.exerciseId));

  function addExercise(event: FormEvent) {
    event.preventDefault();
    const found = { exerciseId: v.selected(form.exerciseId, 'Choose an exercise.'), ...validateTargets(form) };
    setFieldErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setFormError(null);
      try {
        await planExercisesApi.create({ planId: id, exerciseId: Number(form.exerciseId), ...targetPayload(form) });
        toast.success('Exercise added to plan.');
        setForm(emptyForm);
        reload();
      } catch (err) {
        setFormError(getErrorMessage(err));
      }
    });
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await planExercisesApi.remove(removing.planExerciseId);
      toast.success('Exercise removed from plan.');
      setRemoving(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !plan) return <LoadingState label="Loading plan…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!plan) return null;

  return (
    <>
      <Link to="/trainer/plans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All plans
      </Link>
      <PageHeader title={plan.planName} description={`Created ${formatDateTime(plan.createdAt)}`} />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <Card title="Member">
            {plan.member && (
              <div className="flex items-center gap-3">
                <Avatar name={plan.member.fullName} src={plan.member.profileImg} />
                <div>
                  <p className="font-medium">{plan.member.fullName}</p>
                  <p className="text-xs text-faint">{plan.member.email}</p>
                </div>
              </div>
            )}
          </Card>
          <Card title="Add exercise">
            <form onSubmit={addExercise} className="space-y-4" noValidate>
              <FormError message={formError} />
              <SelectField label="Exercise" value={form.exerciseId} error={fieldErrors.exerciseId} onChange={(e) => setForm({ ...form, exerciseId: e.target.value })}>
                <option value="">Select an exercise</option>
                {available.map((e) => (
                  <option key={e.exerciseId} value={e.exerciseId}>
                    {e.exerciseName} · {e.category}
                  </option>
                ))}
              </SelectField>
              <TargetFields value={form} errors={fieldErrors} onChange={(t) => setForm({ ...form, ...t })} />
              <Button type="submit" icon={Plus} loading={adding} className="w-full">
                Add to plan
              </Button>
            </form>
          </Card>
        </div>

        <Card title={`Exercises (${plan.planExercises?.length ?? 0})`} padded={false} className="xl:col-span-2">
          {!plan.planExercises?.length ? (
            <EmptyState title="No exercises in this plan" description="Add exercises with target sets and reps." icon={Dumbbell} />
          ) : (
            <Table
              head={
                <>
                  <Th className="w-12">#</Th>
                  <Th>Exercise</Th>
                  <Th className="text-right">Sets</Th>
                  <Th className="text-right">Reps / time</Th>
                  <Th className="w-28 text-right">Actions</Th>
                </>
              }
            >
              {plan.planExercises.map((item, index) => (
                <tr key={item.planExerciseId} className="hover:bg-raised/50">
                  <Td className="text-faint tabular-nums">{index + 1}</Td>
                  <Td>
                    <p className="font-medium text-ink">{item.exercise?.exerciseName}</p>
                    <p className="text-xs text-faint">{item.exercise?.category}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{item.targetSets}</Td>
                  <Td className="text-right tabular-nums">{item.targetDurationMinutes ? `${item.targetDurationMinutes} min (timed)` : `${item.targetReps} reps`}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <IconButton icon={Pencil} label={`Edit targets for ${item.exercise?.exerciseName}`} onClick={() => setEditing(item)} />
                    <IconButton icon={Trash2} label={`Remove ${item.exercise?.exerciseName}`} className="hover:text-danger" onClick={() => setRemoving(item)} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <PlanCompletionPanel planId={id} version={plan.planExercises?.map((p) => `${p.planExerciseId}:${p.targetSets}x${p.targetReps}:${p.targetDurationMinutes ?? ''}`).join(',') ?? ''} />

      <TargetsModal item={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove exercise?"
        message={`${removing?.exercise?.exerciseName} will be removed from this plan.`}
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

function TargetsModal({ item, onClose, onSaved }: { item: PlanExercise | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [targets, setTargets] = useState<TargetForm>(DEFAULT_TARGETS);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<keyof TargetForm>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (item) {
      setTargets({
        kind: item.targetDurationMinutes ? 'timed' : 'reps',
        targetSets: String(item.targetSets),
        targetReps: String(item.targetReps),
        targetMinutes: item.targetDurationMinutes ? String(item.targetDurationMinutes) : DEFAULT_TARGETS.targetMinutes,
      });
      setError(null);
      setErrors({});
    }
  }, [item]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const found = validateTargets(targets);
    setErrors(found);
    if (v.hasErrors(found)) return;
    const payload = targetPayload(targets);
    void run(async () => {
      setError(null);
      try {
        await planExercisesApi.update(item.planExerciseId, {
          targetSets: payload.targetSets,
          ...(payload.targetReps !== undefined && { targetReps: payload.targetReps }),
          // null switches a timed exercise back to repetition-based.
          targetDurationMinutes: payload.targetDurationMinutes ?? null,
        });
        toast.success('Targets updated. Workouts counted earlier keep the target that applied when they were logged.');
        onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`Edit targets — ${item?.exercise?.exerciseName ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="targets-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="targets-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TargetFields value={targets} errors={errors} onChange={(t) => setTargets({ ...targets, ...t })} />
      </form>
    </Modal>
  );
}

/** Version 2.0: prescribed targets versus what the member actually completed. */
function PlanCompletionPanel({ planId, version }: { planId: number; version: string }) {
  const [period, setPeriod] = useState<CompletionWindow>('week');
  const { data, loading, error, reload } = useFetch(() => completionsApi.plan(planId, { period }), [planId, period, version]);
  return (
    <Card title="Completion — prescribed vs actual" padded={false} className="mt-6" action={<PeriodToggle value={period} onChange={setPeriod} />}>
      {loading && !data ? (
        <LoadingState label="Calculating completion…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <>
          <div className="border-b border-line px-5 py-4">
            <ProgressBar value={data.summary.completionPercent} label="Plan completion" tone={percentTone(data.summary.completionPercent)} />
            <p className="mt-2 text-xs text-muted">
              {data.summary.completedExercises} completed · {data.summary.partialExercises} partial · {data.summary.pendingExercises} pending · {data.summary.linkedWorkouts} workout
              {data.summary.linkedWorkouts === 1 ? '' : 's'} logged from this plan ({formatDate(data.range.from)} – {formatDate(data.range.to)}). Workouts count from{' '}
              {formatDate(data.plan.countsFrom)}.
            </p>
          </div>
          {data.exercises.length === 0 ? (
            <EmptyState title="Nothing prescribed yet" description="Add exercises to see completion." icon={Dumbbell} />
          ) : (
            <Table
              head={
                <>
                  <Th>Exercise</Th>
                  <Th className="text-right">Prescribed</Th>
                  <Th className="text-right">Best actual</Th>
                  <Th className="text-right">Duration</Th>
                  <Th>Last logged</Th>
                  <Th>Status</Th>
                </>
              }
            >
              {data.exercises.map((e) => (
                <tr key={e.planExerciseId} className="hover:bg-raised/50">
                  <Td className="font-medium text-ink">{e.exercise?.exerciseName}</Td>
                  <Td className="text-right tabular-nums">
                    {prescriptionText(e.prescribed)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {e.best ? (e.prescribed.durationMinutes ? `${e.best.actual.sets} sets` : `${e.best.actual.sets} × ${e.best.actual.repetitions}`) : '—'}
                    {e.best && !samePrescription(e.best.prescribedAtTheTime, e.prescribed) && (
                      <span className="block text-[11px] text-faint">
                        target then {prescriptionText(e.best.prescribedAtTheTime)}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{e.best ? `${e.best.actual.durationMinutes} min` : '—'}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDate(e.lastWorkoutDate)}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <CompletionBadge status={e.status} />
                      {e.status === 'partial' && <span className="text-xs tabular-nums text-faint">{e.scorePercent}%</span>}
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- targets (shared by add + edit)

/**
 * A prescription is either repetition-based (sets × reps, Lab 04) or timed
 * (sets + total minutes, migration 003). For timed exercises repetitions are
 * not asked for: the API stores the Lab 04 placeholder TargetReps = 1 and
 * completion compares sets and minutes only.
 */
type TargetForm = { kind: 'reps' | 'timed'; targetSets: string; targetReps: string; targetMinutes: string };
const DEFAULT_TARGETS: TargetForm = { kind: 'reps', targetSets: '3', targetReps: '10', targetMinutes: '20' };

function validateTargets(t: TargetForm): FieldErrors<keyof TargetForm> {
  return {
    targetSets: v.integer(t.targetSets, 'Target sets', 1, v.LIMITS.sets),
    targetReps: t.kind === 'reps' ? v.integer(t.targetReps, 'Target reps', 1, v.LIMITS.targetReps) : undefined,
    targetMinutes: t.kind === 'timed' ? v.integer(t.targetMinutes, 'Target minutes', 1, v.LIMITS.targetMinutes) : undefined,
  };
}

function targetPayload(t: TargetForm): { targetSets: number; targetReps?: number; targetDurationMinutes?: number } {
  return t.kind === 'timed'
    ? { targetSets: Number(t.targetSets), targetDurationMinutes: Number(t.targetMinutes) }
    : { targetSets: Number(t.targetSets), targetReps: Number(t.targetReps) };
}

function TargetFields({ value, errors, onChange }: { value: TargetForm; errors: FieldErrors<string>; onChange: (t: Partial<TargetForm>) => void }) {
  return (
    <>
      <SelectField
        label="Target type"
        value={value.kind}
        onChange={(e) => onChange({ kind: e.target.value as TargetForm['kind'] })}
        hint={value.kind === 'timed' ? 'Completed when the sets and the total minutes are reached; repetitions are not counted.' : 'Completed when the sets and repetitions per set are reached.'}
      >
        <option value="reps">Sets × repetitions</option>
        <option value="timed">Timed — sets and total minutes</option>
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Target sets" type="number" inputMode="numeric" min={1} max={v.LIMITS.sets} value={value.targetSets} error={errors.targetSets} onChange={(e) => onChange({ targetSets: e.target.value })} />
        {value.kind === 'reps' ? (
          <TextField label="Target reps" type="number" inputMode="numeric" min={1} max={v.LIMITS.targetReps} value={value.targetReps} error={errors.targetReps} onChange={(e) => onChange({ targetReps: e.target.value })} />
        ) : (
          <TextField label="Target minutes" type="number" inputMode="numeric" min={1} max={v.LIMITS.targetMinutes} value={value.targetMinutes} error={errors.targetMinutes} onChange={(e) => onChange({ targetMinutes: e.target.value })} />
        )}
      </div>
    </>
  );
}
