import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { completionsApi, logsApi, type WorkoutLogInput } from '../api/services';
import type { WorkoutLog } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useExerciseOptions } from '../hooks/useExerciseOptions';
import { todayISO } from '../lib/format';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import * as v from '../lib/validation';
import { Button, FormError, Modal, SelectField, TextField } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (log: WorkoutLog) => void;
  /** Existing log to edit; omit to create. */
  log?: WorkoutLog | null;
  /** Prefill for "log this exercise" from a plan. */
  preset?: Partial<WorkoutLogInput>;
  /**
   * Version 2.0: log directly from an assigned plan. The workout is saved and
   * counted toward this prescribed plan exercise in one request.
   */
  planContext?: { planExerciseId: number; planName: string; exerciseName: string; prescribed: string; timed?: boolean } | null;
}

type FormState = { exerciseId: string; workoutDate: string; sets: string; repetitions: string; durationMinutes: string };

function toForm(log?: WorkoutLog | null, preset?: Partial<WorkoutLogInput>): FormState {
  const source = log ?? preset ?? {};
  return {
    exerciseId: source.exerciseId ? String(source.exerciseId) : '',
    workoutDate: source.workoutDate ?? todayISO(),
    sets: source.sets !== undefined ? String(source.sets) : '3',
    repetitions: source.repetitions !== undefined ? String(source.repetitions) : '10',
    durationMinutes: source.durationMinutes !== undefined ? String(source.durationMinutes) : '20',
  };
}

/** Create / edit a workout log (POST or PATCH /workout-logs). */
export function WorkoutLogModal({ open, onClose, onSaved, log, preset, planContext }: Props) {
  const toast = useToast();
  const { exercises, loading: loadingExercises } = useExerciseOptions();
  const [form, setForm] = useState<FormState>(() => toForm(log, preset));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (open) {
      setForm(toForm(log, preset));
      setErrors({});
      setServerError(null);
    }
  }, [open, log, preset]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  /** Mirrors CreateWorkoutLogDto (ranges) and the "not in the future" rule. */
  function validate(): boolean {
    const next: typeof errors = {
      exerciseId: v.selected(form.exerciseId, 'Choose an exercise.'),
      workoutDate: v.pastDate(form.workoutDate, 'Workout date'),
      sets: v.integer(form.sets, 'Sets', 1, v.LIMITS.sets),
      repetitions: v.integer(form.repetitions, 'Repetitions', 0, v.LIMITS.logReps),
      durationMinutes:
        v.integer(form.durationMinutes, 'Duration', 0, v.LIMITS.logMinutes) ??
        (planContext?.timed && Number(form.durationMinutes) === 0 ? 'Enter the minutes you trained — this timed exercise is measured in minutes.' : undefined),
    };
    setErrors(next);
    return !v.hasErrors(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    const payload: WorkoutLogInput = {
      exerciseId: Number(form.exerciseId),
      workoutDate: form.workoutDate,
      sets: Number(form.sets),
      repetitions: Number(form.repetitions),
      durationMinutes: Number(form.durationMinutes),
    };
    void run(async () => {
      setServerError(null);
      try {
        const saved = log
          ? await logsApi.update(log.logId, payload)
          : planContext
            ? await completionsApi.logFromPlan({ ...payload, planExerciseId: planContext.planExerciseId })
            : await logsApi.create(payload);
        if (planContext && saved.completion) {
          toast.success(saved.completion.status === 'completed' ? `Workout recorded — ${planContext.exerciseName} completed.` : `Workout recorded — counted as partial (${saved.completion.scorePercent}%).`);
        } else {
          toast.success(log ? 'Workout updated.' : 'Workout recorded.');
        }
        onSaved(saved);
        onClose();
      } catch (err) {
        setServerError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={log ? 'Edit workout' : planContext ? 'Log workout from plan' : 'Record workout'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="workout-log-form" loading={saving}>
            {log ? 'Save changes' : 'Record workout'}
          </Button>
        </>
      }
    >
      <form id="workout-log-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={serverError} />
        </div>
        {planContext && (
          <p className="rounded-xl border border-lime/25 bg-lime/5 px-3.5 py-2.5 text-sm text-muted sm:col-span-2">
            Counts toward <span className="font-medium text-ink">{planContext.planName}</span> — prescribed <span className="font-medium text-ink">{planContext.prescribed}</span>. Enter what you actually did.
            {planContext.timed && ' This is a timed exercise: it is measured by sets and minutes, so repetitions are not needed (leave 0).'}
          </p>
        )}
        <SelectField label="Exercise" value={form.exerciseId} onChange={set('exerciseId')} error={errors.exerciseId} className="sm:col-span-2" disabled={loadingExercises || Boolean(planContext)}>
          <option value="">{loadingExercises ? 'Loading exercises…' : 'Select an exercise'}</option>
          {exercises.map((exercise) => (
            <option key={exercise.exerciseId} value={exercise.exerciseId}>
              {exercise.exerciseName} · {exercise.category}
            </option>
          ))}
        </SelectField>
        <TextField label="Workout date" type="date" max={todayISO()} value={form.workoutDate} onChange={set('workoutDate')} error={errors.workoutDate} />
        <TextField label="Duration (minutes)" type="number" min={0} max={v.LIMITS.logMinutes} inputMode="numeric" value={form.durationMinutes} onChange={set('durationMinutes')} error={errors.durationMinutes} />
        <TextField label="Sets" type="number" min={1} max={v.LIMITS.sets} inputMode="numeric" value={form.sets} onChange={set('sets')} error={errors.sets} />
        <TextField
          label="Repetitions per set"
          type="number"
          min={0}
          max={v.LIMITS.logReps}
          inputMode="numeric"
          value={form.repetitions}
          onChange={set('repetitions')}
          error={errors.repetitions}
          hint={planContext?.timed ? 'Not used for timed exercises.' : 'Use 0 for timed or cardio exercises.'}
        />
      </form>
    </Modal>
  );
}
