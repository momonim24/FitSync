import { ClipboardList, History, Link2, Plus, Unlink } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { completionsApi, logsApi, plansApi, type WorkoutLogInput } from '../../api/services';
import type { PlanCompletionExercise, WorkoutPlan } from '../../api/types';
import { CompletionBadge, PeriodToggle, ProgressBar, percentTone, performanceText, prescriptionText, type CompletionWindow } from '../../components/fitness';
import { Avatar, Badge, Button, EmptyState, ErrorState, IconButton, LoadingState, Modal, PageHeader, Spinner } from '../../components/ui';
import { WorkoutLogModal } from '../../components/WorkoutLogModal';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { dateOfInstant, formatDate, formatDateTime } from '../../lib/format';

type LogTarget = { plan: WorkoutPlan; item: PlanCompletionExercise };

/**
 * Member: workout plans from trainers, with completion tracking.
 * Each prescribed exercise shows completed / partial / pending for the
 * selected period, the best actual workout versus the prescription, and
 * can be logged directly from the plan.
 */
export default function MemberPlansPage() {
  const { data, loading, error, reload } = useFetch(() => plansApi.list({ limit: 50 }), []);
  const [period, setPeriod] = useState<CompletionWindow>('week');
  const [version, setVersion] = useState(0);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [linkTarget, setLinkTarget] = useState<LogTarget | null>(null);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <>
      <PageHeader
        title="My Workout Plans"
        description="Plans from your trainers. Log workouts from a plan to track completion."
        actions={<PeriodToggle value={period} onChange={setPeriod} />}
      />

      {loading && !data ? (
        <LoadingState label="Loading plans…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No plans yet" description="When a trainer creates a workout plan for you, it will appear here." icon={ClipboardList} />
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-faint">
            An exercise is <strong className="text-muted">completed</strong> when a workout logged from the plan meets both the prescribed sets and repetitions,{' '}
            <strong className="text-muted">partial</strong> when it falls short, and <strong className="text-muted">pending</strong> when nothing was logged in the period. Several
            workouts for the same exercise count once (the best one). Other workouts never count toward a plan.
          </p>
          <div className="grid gap-6 xl:grid-cols-2">
            {data?.items.map((plan) => (
              <PlanCard key={plan.planId} plan={plan} period={period} version={version} onLog={(item) => setLogTarget({ plan, item })} onLink={(item) => setLinkTarget({ plan, item })} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      <WorkoutLogModal
        open={Boolean(logTarget)}
        preset={
          logTarget
            ? ({
                exerciseId: logTarget.item.exercise?.exerciseId,
                sets: logTarget.item.prescribed.sets,
                // Timed exercises: no repetitions needed; prefill the prescribed minutes instead.
                repetitions: logTarget.item.prescribed.durationMinutes ? 0 : logTarget.item.prescribed.reps,
                ...(logTarget.item.prescribed.durationMinutes && { durationMinutes: logTarget.item.prescribed.durationMinutes }),
              } as Partial<WorkoutLogInput>)
            : undefined
        }
        planContext={
          logTarget
            ? {
                planExerciseId: logTarget.item.planExerciseId,
                planName: logTarget.plan.planName,
                exerciseName: logTarget.item.exercise?.exerciseName ?? 'Exercise',
                prescribed: prescriptionText(logTarget.item.prescribed),
                timed: Boolean(logTarget.item.prescribed.durationMinutes),
              }
            : null
        }
        onClose={() => setLogTarget(null)}
        onSaved={refresh}
      />
      <LinkWorkoutModal target={linkTarget} onClose={() => setLinkTarget(null)} onLinked={refresh} />
    </>
  );
}

function PlanCard({
  plan,
  period,
  version,
  onLog,
  onLink,
  onChanged,
}: {
  plan: WorkoutPlan;
  period: CompletionWindow;
  version: number;
  onLog: (item: PlanCompletionExercise) => void;
  onLink: (item: PlanCompletionExercise) => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useFetch(() => completionsApi.plan(plan.planId, { period }), [plan.planId, period, version]);
  const [showHistory, setShowHistory] = useState(false);
  const s = data?.summary;

  return (
    <article className="card overflow-hidden" aria-label={`Workout plan ${plan.planName}`}>
      <header className="border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-ink">{plan.planName}</h2>
            <p className="mt-1 text-xs text-faint">Created {formatDateTime(plan.createdAt)}</p>
          </div>
          <Badge tone="lime">{plan.planExercises?.length ?? 0} exercises</Badge>
        </div>
        <div className="mt-4">
          {loading && !data ? (
            <div className="flex items-center gap-2 text-xs text-faint">
              <Spinner className="size-3.5" /> Calculating completion…
            </div>
          ) : error ? (
            <p className="text-xs text-danger">
              {error}{' '}
              <button type="button" onClick={reload} className="underline">
                Retry
              </button>
            </p>
          ) : s ? (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>Completion · {period === 'week' ? 'last 7 days' : 'last 30 days'}</span>
                <span>
                  {s.completedExercises} completed · {s.partialExercises} partial · {s.pendingExercises} pending
                </span>
              </div>
              <ProgressBar value={s.completionPercent} label={`${plan.planName} completion`} tone={percentTone(s.completionPercent)} />
            </>
          ) : null}
        </div>
      </header>
      {plan.trainer && (
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Avatar name={plan.trainer.fullName} src={plan.trainer.profileImg} size="sm" />
          <p className="text-sm text-muted">
            Coach <span className="font-medium text-ink">{plan.trainer.fullName}</span>
          </p>
        </div>
      )}
      {data && data.exercises.length > 0 ? (
        <ol className="divide-y divide-line">
          {data.exercises.map((item, index) => (
            <li key={item.planExerciseId} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-raised text-xs font-semibold text-muted">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.exercise?.exerciseName}</p>
                  <p className="text-xs text-faint">
                    Prescribed {prescriptionText(item.prescribed)}
                    {item.best
                      ? ` · Best ${performanceText(item.best.actual, item.best.prescribedAtTheTime)} (${formatDate(item.best.workoutDate)})`
                      : ''}
                    {item.attempts > 1 ? ` · ${item.attempts} workouts` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
                <CompletionBadge status={item.status} />
                <Button size="sm" variant="secondary" icon={Plus} aria-label={`Log ${item.exercise?.exerciseName} from this plan`} onClick={() => onLog(item)}>
                  Log
                </Button>
                <IconButton icon={Link2} label={`Count an earlier ${item.exercise?.exerciseName} workout`} onClick={() => onLink(item)} />
              </div>
            </li>
          ))}
        </ol>
      ) : data ? (
        <p className="px-5 py-6 text-sm text-muted">Your trainer has not added exercises to this plan yet.</p>
      ) : null}
      <div className="border-t border-line px-5 py-3">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-lime hover:underline focus-visible:outline-2 focus-visible:outline-lime"
        >
          <History className="size-3.5" aria-hidden /> {showHistory ? 'Hide' : 'Show'} completion history
        </button>
        {showHistory && <PlanHistory planId={plan.planId} version={data ? data.summary.linkedWorkouts : 0} onChanged={onChanged} />}
      </div>
    </article>
  );
}

function PlanHistory({ planId, version, onChanged }: { planId: number; version: number; onChanged: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => completionsApi.history({ planId, limit: 20 }), [planId, version]);
  const [busy, setBusy] = useState<number | null>(null);

  async function unlink(id: number) {
    setBusy(id);
    try {
      await completionsApi.unlink(id);
      toast.success('Workout no longer counts toward this plan. The workout log was kept.');
      reload();
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <p className="mt-3 text-xs text-faint">Loading history…</p>;
  if (error) return <p className="mt-3 text-xs text-danger">{error}</p>;
  if (!data || data.items.length === 0) return <p className="mt-3 text-xs text-faint">No workouts have been counted toward this plan yet.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {data.items.map((c) => (
        <li key={c.completionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-raised px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="font-medium text-ink">{c.exercise?.exerciseName}</span>
            <span className="text-muted">
              {' '}
              · {formatDate(c.workoutDate)} · {performanceText(c.actual, c.prescribed)} of {prescriptionText(c.prescribed)}
            </span>
            {c.planExerciseRemoved && <span className="text-faint"> · removed from plan</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <CompletionBadge status={c.status} />
            <IconButton icon={Unlink} label={`Stop counting the ${c.exercise?.exerciseName} workout from ${c.workoutDate}`} disabled={busy === c.completionId} onClick={() => unlink(c.completionId)} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Count a workout that was logged earlier (not from the plan) toward a plan exercise. */
function LinkWorkoutModal({ target, onClose, onLinked }: { target: LogTarget | null; onClose: () => void; onLinked: () => void }) {
  const toast = useToast();
  const exerciseId = target?.item.exercise?.exerciseId;
  const since = target ? dateOfInstant(target.plan.createdAt) : undefined;
  const { data, loading, error } = useFetch(async () => {
    if (!target || !exerciseId) return null;
    const [logs, linked] = await Promise.all([logsApi.list({ exerciseId, from: since, limit: 30 }), completionsApi.history({ from: since, limit: 100 })]);
    const used = new Set(linked.items.map((c) => c.logId));
    return logs.items.filter((l) => !used.has(l.logId));
  }, [target]);
  const [choice, setChoice] = useState<number | null>(null);
  const { submitting: saving, run } = useSubmitGuard();

  function submit() {
    if (!target || choice === null) return;
    void run(async () => {
      try {
        const c = await completionsApi.link(choice, target.item.planExerciseId);
        toast.success(c.status === 'completed' ? 'Workout counted — exercise completed.' : `Workout counted as partial (${c.scorePercent}%).`);
        onLinked();
        onClose();
        setChoice(null);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title="Count an earlier workout"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={choice === null}>
            Count workout
          </Button>
        </>
      }
    >
      {target && (
        <p className="mb-4 text-sm text-muted">
          Choose a <span className="text-ink">{target.item.exercise?.exerciseName}</span> workout logged since the plan was created ({since}) that is not counted yet. Prescribed{' '}
          {prescriptionText(target.item.prescribed)}.
        </p>
      )}
      {loading ? (
        <LoadingState label="Loading workouts…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No matching workouts" description="Only uncounted workouts of the same exercise, logged on or after the plan date, can be counted." />
      ) : (
        <fieldset>
          <legend className="sr-only">Workouts</legend>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {data.map((log) => (
              <li key={log.logId}>
                <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${choice === log.logId ? 'border-lime bg-lime/5' : 'border-line hover:border-line-strong'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="link-log" className="accent-lime" checked={choice === log.logId} onChange={() => setChoice(log.logId)} />
                    {formatDate(log.workoutDate)}
                  </span>
                  <span className="tabular-nums text-muted">
                    {log.sets} × {log.repetitions} · {log.durationMinutes} min
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </Modal>
  );
}
