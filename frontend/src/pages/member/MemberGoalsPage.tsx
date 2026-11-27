import { Info, Pencil, Plus, Target, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { goalsApi, type GoalInput } from '../../api/services';
import type { FitnessGoal, GoalStatus, GoalType } from '../../api/types';
import { GOAL_TYPE_LABEL, GoalCard, GoalWeeks } from '../../components/fitness';
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, LoadingState, Modal, PageHeader, Pagination, SelectField, TextField } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';
import { todayISO } from '../../lib/format';

const TABS: Array<{ key: GoalStatus | 'All'; label: string }> = [
  { key: 'Active', label: 'Active' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Missed', label: 'Missed' },
  { key: 'Cancelled', label: 'Cancelled' },
  { key: 'All', label: 'All' },
];

const addDaysISO = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
};
const weeksBetween = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1) / 7;

/** Member: create, monitor, update and cancel fitness goals. */
export default function MemberGoalsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<GoalStatus | 'All'>('Active');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => goalsApi.list({ status: tab === 'All' ? undefined : tab, page, limit: 12 }), [tab, page]);
  const [editing, setEditing] = useState<FitnessGoal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<FitnessGoal | null>(null);
  const [details, setDetails] = useState<FitnessGoal | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await goalsApi.cancel(cancelling.goalId);
      toast.success('Goal cancelled. It stays in your history.');
      setCancelling(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openDetails(goal: FitnessGoal) {
    try {
      setDetails(await goalsApi.get(goal.goalId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Fitness Goals"
        description="Set a goal and FitSync measures it from the workouts and weight records you already log."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New goal
          </Button>
        }
      />

      <div role="tablist" aria-label="Goal status" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-lime ${
              tab === t.key ? 'bg-lime/10 text-lime' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <LoadingState label="Loading goals…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            title={tab === 'Active' ? 'No active goals' : `No ${tab === 'All' ? '' : tab.toLowerCase() + ' '}goals`}
            description={tab === 'Active' ? 'Create a goal for your weight, weekly workout days or weekly training minutes.' : undefined}
            icon={Target}
            action={
              tab === 'Active' ? (
                <Button icon={Plus} onClick={() => (setEditing(null), setFormOpen(true))}>
                  New goal
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : data ? (
        <>
          <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((goal) => (
              <GoalCard
                key={goal.goalId}
                goal={goal}
                actions={
                  <>
                    {goal.goalType !== 'TargetWeight' && (
                      <Button size="sm" variant="ghost" onClick={() => openDetails(goal)}>
                        Week by week
                      </Button>
                    )}
                    {goal.status === 'Active' && (
                      <>
                        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => (setEditing(goal), setFormOpen(true))} aria-label={`Edit ${goal.goalName}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setCancelling(goal)} aria-label={`Cancel ${goal.goalName}`}>
                          Cancel goal
                        </Button>
                      </>
                    )}
                  </>
                }
              />
            ))}
          </div>
          <div className="card mt-4">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </div>
        </>
      ) : null}

      <p className="mt-6 flex items-start gap-2 text-xs text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        FitSync only measures the goals you set; it does not give medical or nutritional advice. Talk to a qualified professional before setting weight targets.
      </p>

      <GoalFormModal open={formOpen} goal={editing} onClose={() => setFormOpen(false)} onSaved={reload} />
      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.goalName ?? 'Goal'} size="lg">
        {details && (
          <>
            <p className="text-sm text-muted">
              {GOAL_TYPE_LABEL[details.goalType]} — each goal week is 7 days starting on {details.startDate}. A week is met when it reaches the target.
            </p>
            <GoalWeeks goal={details} />
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel this goal?"
        message={
          <>
            <strong className="text-ink">{cancelling?.goalName}</strong> will stop being tracked. It stays in your goal history and cannot be re-opened.
          </>
        }
        confirmLabel="Cancel goal"
        loading={busy}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}

type GoalField = 'goalName' | 'targetValue' | 'startingValue' | 'startDate' | 'targetDate' | 'weeks';

function GoalFormModal({ open, goal, onClose, onSaved }: { open: boolean; goal: FitnessGoal | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ goalType: 'WeeklyWorkouts' as GoalType, goalName: '', targetValue: '', startingValue: '', startDate: todayISO(), weeks: '4', targetDate: addDaysISO(todayISO(), 56) });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<GoalField>>({});
  const { submitting: saving, run } = useSubmitGuard();
  const isWeight = form.goalType === 'TargetWeight';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrors({});
    if (goal) {
      setForm({
        goalType: goal.goalType,
        goalName: goal.goalName,
        targetValue: String(goal.targetValue),
        startingValue: goal.startingValue !== null ? String(goal.startingValue) : '',
        startDate: goal.startDate,
        weeks: String(weeksBetween(goal.startDate, goal.targetDate)),
        targetDate: goal.targetDate,
      });
    } else {
      setForm({ goalType: 'WeeklyWorkouts', goalName: '', targetValue: '3', startingValue: '', startDate: todayISO(), weeks: '4', targetDate: addDaysISO(todayISO(), 56) });
    }
  }, [open, goal]);

  const computedTargetDate = useMemo(() => {
    if (isWeight) return form.targetDate;
    const weeks = Number(form.weeks);
    return Number.isInteger(weeks) && weeks > 0 ? addDaysISO(form.startDate, weeks * 7 - 1) : '';
  }, [isWeight, form.targetDate, form.weeks, form.startDate]);

  /** Mirrors the API rules in fitness-goals.service.ts (ranges, dates, whole goal weeks). */
  function validateGoal(): FieldErrors<GoalField> {
    const today = todayISO();
    const found: FieldErrors<GoalField> = { goalName: v.requiredText(form.goalName, 'Goal name', v.LIMITS.name, v.LIMITS.goalNameMin) };
    if (isWeight) {
      found.targetValue = v.decimal(form.targetValue, 'Target weight', { min: 20, max: 400 });
      if (form.startingValue.trim()) {
        found.startingValue = v.decimal(form.startingValue, 'Starting weight', { min: 20, max: 400 });
        if (!found.startingValue && !found.targetValue && Number(form.startingValue) === Number(form.targetValue)) {
          found.targetValue = 'Target weight must be different from the starting weight.';
        }
      }
    } else if (form.goalType === 'WeeklyWorkouts') {
      found.targetValue = v.integer(form.targetValue, 'Workout days per week', 1, 7);
    } else {
      found.targetValue = v.integer(form.targetValue, 'Minutes per week', 10, 2000);
    }
    if (!goal) {
      found.startDate = v.requiredDate(form.startDate, 'Start date') ?? (Math.abs(v.daysBetween(today, form.startDate)) > 90 ? 'Start date must be within 90 days of today.' : undefined);
    }
    if (isWeight) {
      found.targetDate =
        v.requiredDate(form.targetDate, 'Target date') ??
        (form.targetDate <= form.startDate
          ? 'Target date must be after the start date.'
          : form.targetDate < today
            ? 'Target date cannot be in the past.'
            : v.daysBetween(form.startDate, form.targetDate) + 1 > 730
              ? 'A goal can cover at most 730 days.'
              : undefined);
    } else {
      found.weeks = v.integer(form.weeks, 'Duration', 1, 104) ?? (computedTargetDate && computedTargetDate < today ? 'This duration ends in the past; choose more weeks.' : undefined);
    }
    return found;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateGoal();
    setErrors(found);
    if (v.hasErrors(found)) return;
    const target = Number(form.targetValue);
    const startingValue = form.startingValue.trim() ? Number(form.startingValue) : undefined;
    void run(() => save(target, startingValue));
  }

  async function save(target: number, startingValue: number | undefined) {
    setError(null);
    try {
      if (goal) {
        await goalsApi.update(goal.goalId, {
          goalName: form.goalName.trim(),
          targetValue: target,
          targetDate: computedTargetDate,
          ...(isWeight && startingValue !== undefined && { startingValue }),
        });
        toast.success('Goal updated.');
      } else {
        const payload: GoalInput = { goalType: form.goalType, goalName: form.goalName.trim(), targetValue: target, startDate: form.startDate, targetDate: computedTargetDate };
        if (isWeight && startingValue !== undefined) payload.startingValue = startingValue;
        await goalsApi.create(payload);
        toast.success('Goal created.');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const set =(key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New fitness goal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" form="goal-form" loading={saving}>
            {goal ? 'Save changes' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <SelectField
          label="Goal type"
          value={form.goalType}
          disabled={Boolean(goal)}
          className="sm:col-span-2"
          onChange={(e) => {
            const goalType = e.target.value as GoalType;
            setForm({ ...form, goalType, targetValue: goalType === 'WeeklyWorkouts' ? '3' : goalType === 'WeeklyMinutes' ? '150' : '' });
          }}
        >
          <option value="WeeklyWorkouts">Weekly workouts — workout days per week</option>
          <option value="WeeklyMinutes">Weekly minutes — training time per week</option>
          <option value="TargetWeight">Target weight — reach a body weight</option>
        </SelectField>
        <TextField label="Goal name" className="sm:col-span-2" maxLength={v.LIMITS.name} error={errors.goalName} value={form.goalName} onChange={set('goalName')} placeholder={isWeight ? 'e.g. Reach 75 kg' : 'e.g. Train 3 days a week'} />
        {isWeight ? (
          <>
            <TextField
              label="Starting weight (kg)"
              type="number"
              step="0.1"
              min={20}
              max={400}
              inputMode="decimal"
              value={form.startingValue}
              onChange={set('startingValue')}
              error={errors.startingValue}
              hint={goal ? undefined : 'Leave empty to use your latest weight record.'}
            />
            <TextField label="Target weight (kg)" type="number" step="0.1" min={20} max={400} inputMode="decimal" value={form.targetValue} onChange={set('targetValue')} error={errors.targetValue} />
          </>
        ) : (
          <TextField
            label={form.goalType === 'WeeklyWorkouts' ? 'Workout days per week' : 'Minutes per week'}
            type="number"
            min={form.goalType === 'WeeklyWorkouts' ? 1 : 10}
            max={form.goalType === 'WeeklyWorkouts' ? 7 : 2000}
            inputMode="numeric"
            className="sm:col-span-2"
            value={form.targetValue}
            onChange={set('targetValue')}
            error={errors.targetValue}
            hint={form.goalType === 'WeeklyWorkouts' ? 'Days with at least one logged workout (1–7).' : 'Sum of logged workout durations (10–2000).'}
          />
        )}
        <TextField label="Start date" type="date" value={form.startDate} onChange={set('startDate')} disabled={Boolean(goal)} error={errors.startDate} />
        {isWeight ? (
          <TextField label="Target date" type="date" min={todayISO()} value={form.targetDate} onChange={set('targetDate')} error={errors.targetDate} />
        ) : (
          <TextField
            label="Duration (weeks)"
            type="number"
            min={1}
            max={104}
            inputMode="numeric"
            value={form.weeks}
            onChange={set('weeks')}
            error={errors.weeks}
            hint={computedTargetDate ? `Ends ${computedTargetDate}` : undefined}
          />
        )}
      </form>
    </Modal>
  );
}
