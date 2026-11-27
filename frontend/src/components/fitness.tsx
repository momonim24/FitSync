import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Flag,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Scale,
  Target,
  Timer,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { CompletionStatus, FeedbackType, FitnessGoal, GoalState, GoalType, TrainerFeedback } from '../api/types';
import { dateOfInstant, formatDate, formatDateTime } from '../lib/format';
import { Badge } from './ui';

type Tone = 'lime' | 'neutral' | 'danger' | 'info' | 'warning';

// ---------------------------------------------------------------- Progress bar
const barTones: Record<Tone, string> = {
  lime: 'bg-lime',
  neutral: 'bg-line-strong',
  danger: 'bg-danger',
  info: 'bg-info',
  warning: 'bg-warning',
};

/**
 * Accessible progress bar (role="progressbar"). `value` null means "no data"
 * and renders an empty track with a text label instead of a misleading 0 %.
 */
export function ProgressBar({ value, label, tone = 'lime', showValue = true, size = 'md' }: { value: number | null; label: string; tone?: Tone; showValue?: boolean; size?: 'sm' | 'md' }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : pct}
        aria-valuetext={value === null ? 'No data yet' : `${pct}%`}
        className={`relative flex-1 overflow-hidden rounded-full bg-raised ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${barTones[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {showValue && <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{value === null ? '—' : `${pct}%`}</span>}
    </div>
  );
}

/** Tone for a completion / progress percentage. */
export const percentTone = (value: number | null): Tone => (value === null ? 'neutral' : value >= 80 ? 'lime' : value >= 50 ? 'info' : 'warning');

// ---------------------------------------------------------------- Completion status
const COMPLETION: Record<CompletionStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  completed: { label: 'Completed', tone: 'lime', icon: CheckCircle2 },
  partial: { label: 'Partial', tone: 'warning', icon: CircleDot },
  pending: { label: 'Pending', tone: 'neutral', icon: CircleDashed },
};

export function CompletionBadge({ status }: { status: CompletionStatus }) {
  const { label, tone, icon: Icon } = COMPLETION[status];
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------- Goals
export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  TargetWeight: 'Target weight',
  WeeklyWorkouts: 'Weekly workouts',
  WeeklyMinutes: 'Weekly minutes',
};
export const GOAL_TYPE_ICON: Record<GoalType, LucideIcon> = { TargetWeight: Scale, WeeklyWorkouts: CalendarClock, WeeklyMinutes: Timer };

const GOAL_STATE: Record<GoalState, { label: string; tone: Tone; icon: LucideIcon }> = {
  OnTrack: { label: 'On track', tone: 'lime', icon: CheckCircle2 },
  InProgress: { label: 'In progress', tone: 'lime', icon: CircleDot },
  Behind: { label: 'Behind', tone: 'warning', icon: AlertTriangle },
  NoData: { label: 'No data yet', tone: 'neutral', icon: CircleDashed },
  Upcoming: { label: 'Upcoming', tone: 'info', icon: Clock },
  Achieved: { label: 'Achieved', tone: 'lime', icon: Flag },
  Missed: { label: 'Missed', tone: 'danger', icon: XCircle },
  Cancelled: { label: 'Cancelled', tone: 'neutral', icon: XCircle },
};

export function GoalStateBadge({ state }: { state: GoalState }) {
  const { label, tone, icon: Icon } = GOAL_STATE[state];
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** "80 → 75 kg", "3 workout days / week", "150 min / week" */
export function goalTargetText(goal: Pick<FitnessGoal, 'goalType' | 'startingValue' | 'targetValue'>): string {
  if (goal.goalType === 'TargetWeight') return `${goal.startingValue} → ${goal.targetValue} kg`;
  if (goal.goalType === 'WeeklyWorkouts') return `${goal.targetValue} workout day${goal.targetValue === 1 ? '' : 's'} / week`;
  return `${goal.targetValue} min / week`;
}

/** What the member has right now, in words. */
export function goalCurrentText(goal: FitnessGoal): string {
  const p = goal.progress;
  if (p.state === 'Upcoming') return `Starts ${formatDate(goal.startDate)}`;
  if (goal.goalType === 'TargetWeight') {
    if (!p.weight || p.weight.latestKg === null) return 'No weight recorded since the goal started';
    const change = p.weight.changeKg ?? 0;
    return `Latest ${p.weight.latestKg} kg (${change > 0 ? '+' : ''}${change} kg)${p.weight.remainingKg ? ` · ${p.weight.remainingKg} kg to go` : ''}`;
  }
  const w = p.weekly;
  if (!w) return '';
  const week = w.currentWeek ? `This week ${w.currentWeek.value} / ${w.currentWeek.target}${goal.goalType === 'WeeklyMinutes' ? ' min' : ' days'}` : 'Goal period ended';
  return `${week} · ${w.weeksMet} of ${w.totalWeeks} weeks met`;
}

export function GoalCard({ goal, actions, showMember = false, children }: { goal: FitnessGoal; actions?: ReactNode; showMember?: boolean; children?: ReactNode }) {
  const Icon = GOAL_TYPE_ICON[goal.goalType];
  const p = goal.progress;
  const closed = goal.status !== 'Active';
  return (
    <article className="card flex flex-col p-5" aria-label={`Goal: ${goal.goalName}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-lime">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold text-ink">{goal.goalName}</h3>
          <p className="mt-0.5 text-xs text-faint">
            {GOAL_TYPE_LABEL[goal.goalType]} · {goalTargetText(goal)}
            {showMember && goal.member ? ` · ${goal.member.fullName}` : ''}
          </p>
        </div>
        <GoalStateBadge state={p.state} />
      </div>
      <div className="mt-4">
        <ProgressBar value={p.progressPercent} label={`${goal.goalName} progress`} tone={p.state === 'Missed' ? 'danger' : percentTone(p.progressPercent)} />
        <p className="mt-2 text-xs text-muted">{goalCurrentText(goal)}</p>
        {p.evidenceChanged && (
          <p role="note" className="mt-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            {goal.status === 'Completed'
              ? `Achieved — the records that met this goal were changed after it closed. Current measurement: ${p.liveProgressPercent ?? 'no data'}${p.liveProgressPercent != null ? '%' : ''}. The achievement is kept.`
              : 'Records changed after this goal closed.'}
          </p>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-raised p-3 text-xs">
        <div>
          <dt className="text-faint">Period</dt>
          <dd className="mt-0.5 text-ink">
            {formatDate(goal.startDate)} – {formatDate(goal.targetDate)}
          </dd>
        </div>
        <div>
          <dt className="text-faint">{closed ? 'Closed' : 'Deadline'}</dt>
          <dd className="mt-0.5 text-ink">
            {closed
              ? `${goal.status}${goal.closedAt ? ` · ${formatDate(dateOfInstant(goal.closedAt))}` : ''}`
              : p.daysRemaining === 0
                ? 'Today'
                : `${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'} left`}
          </dd>
        </div>
      </dl>
      {children}
      {actions && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">{actions}</div>}
    </article>
  );
}

/** Week-by-week table for weekly goals. */
export function GoalWeeks({ goal }: { goal: FitnessGoal }) {
  const weeks = goal.progress.weekly?.weeks;
  if (!weeks?.length) return null;
  const unit = goal.goalType === 'WeeklyMinutes' ? 'min' : 'days';
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Goal weeks for {goal.goalName}</caption>
        <thead className="text-faint">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Week</th>
            <th className="py-1.5 pr-3 font-medium">Dates</th>
            <th className="py-1.5 pr-3 text-right font-medium">Result</th>
            <th className="py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {weeks.map((w) => (
            <tr key={w.index}>
              <td className="py-1.5 pr-3 tabular-nums">{w.index}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-muted">
                {formatDate(w.from)} – {formatDate(w.to)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {w.value} / {w.target} {unit}
              </td>
              <td className="py-1.5">
                {w.met ? <Badge tone="lime">Met</Badge> : w.finished ? <Badge tone="warning">Missed</Badge> : w.from > goal.progress.evaluatedThrough ? <Badge>Upcoming</Badge> : <Badge tone="info">In progress</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Feedback
export const FEEDBACK_TYPES: FeedbackType[] = ['General', 'Encouragement', 'Guidance', 'Concern'];
const FEEDBACK_STYLE: Record<FeedbackType, { tone: Tone; icon: LucideIcon }> = {
  General: { tone: 'neutral', icon: MessageSquare },
  Encouragement: { tone: 'lime', icon: HeartHandshake },
  Guidance: { tone: 'info', icon: Lightbulb },
  Concern: { tone: 'warning', icon: AlertTriangle },
};

export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  const { tone, icon: Icon } = FEEDBACK_STYLE[type];
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden />
      {type}
    </Badge>
  );
}

/**
 * One feedback entry. The message is rendered as plain text (React escapes
 * it; line breaks are kept with whitespace-pre-line) — never as HTML.
 */
export function FeedbackCard({ item, viewer, actions }: { item: TrainerFeedback; viewer: 'member' | 'trainer'; actions?: ReactNode }) {
  const isNew = viewer === 'member' && !item.isRead;
  const who = viewer === 'member' ? item.trainer?.fullName : item.member?.fullName;
  return (
    <article className={`relative px-5 py-4 ${isNew ? 'bg-lime/[0.04]' : ''}`} aria-label={`${isNew ? 'New ' : ''}feedback ${viewer === 'member' ? 'from' : 'for'} ${who ?? 'unknown'}`}>
      {isNew && <span className="absolute inset-y-0 left-0 w-1 bg-lime" aria-hidden />}
      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTypeBadge type={item.feedbackType} />
        {isNew && <Badge tone="lime">New</Badge>}
        {viewer === 'trainer' && <Badge tone={item.isRead ? 'neutral' : 'info'}>{item.isRead ? 'Read by member' : 'Not read yet'}</Badge>}
        {item.relatedGoal && (
          <Badge tone="info">
            <Target className="size-3" aria-hidden /> {item.relatedGoal.goalName}
          </Badge>
        )}
        {item.relatedPlan && <Badge tone="info">Plan: {item.relatedPlan.planName}</Badge>}
      </div>
      <p className="mt-2.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{item.feedbackMessage}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-faint">
          {viewer === 'member' ? 'From' : 'To'} <span className="text-muted">{who ?? '—'}</span> · {formatDateTime(item.createdAt)}
          {item.edited && ' · edited'}
        </p>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Period toggle
export type CompletionWindow = 'week' | 'month';
export function PeriodToggle({ value, onChange, label = 'Completion period' }: { value: CompletionWindow; onChange: (v: CompletionWindow) => void; label?: string }) {
  const options: Array<[CompletionWindow, string]> = [
    ['week', 'Last 7 days'],
    ['month', 'Last 30 days'],
  ];
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-raised p-1">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-lime ${value === key ? 'bg-lime text-on-lime' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Small "x of y" + bar used in tables. */
export function CompletionCell({ percent, label }: { percent: number | null; label: string }) {
  if (percent === null) return <span className="text-xs text-faint">No plan exercises</span>;
  return (
    <div className="min-w-28">
      <ProgressBar value={percent} label={label} tone={percentTone(percent)} size="sm" />
    </div>
  );
}

// ---------------------------------------------------------------- prescriptions
type PrescriptionLike = { sets: number; reps: number; durationMinutes?: number | null };
type PerformanceLike = { sets: number; repetitions: number; durationMinutes: number };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "3 × 12" for repetition-based, "3 sets · 3 min" for timed (duration-based) prescriptions. */
export function prescriptionText(p: PrescriptionLike): string {
  return p.durationMinutes ? `${plural(p.sets, 'set')} · ${p.durationMinutes} min` : `${p.sets} × ${p.reps}`;
}

/** What was done, in the same terms as the prescription it is compared with. */
export function performanceText(a: PerformanceLike, p: PrescriptionLike): string {
  return p.durationMinutes ? `${plural(a.sets, 'set')} · ${a.durationMinutes} min` : `${a.sets} × ${a.repetitions}, ${a.durationMinutes} min`;
}

export const samePrescription = (a: PrescriptionLike, b: PrescriptionLike) =>
  a.sets === b.sets && a.reps === b.reps && (a.durationMinutes ?? null) === (b.durationMinutes ?? null);
