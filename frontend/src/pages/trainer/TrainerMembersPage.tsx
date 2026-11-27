import { BarChart3, ClipboardList, History, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/services';
import { Avatar, Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { CompletionCell } from '../../components/fitness';
import { formatDate, formatDateTime } from '../../lib/format';

/** Trainer: members assigned to them, with quick links to history, progress and plans. */
export default function TrainerMembersPage() {
  const { data, loading, error, reload } = useFetch(() => dashboardApi.trainer(), []);

  return (
    <>
      <PageHeader title="My Members" description="Members assigned to you by an administrator." />
      {loading && !data ? (
        <LoadingState label="Loading members…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.members.length === 0 ? (
        <div className="card">
          <EmptyState title="No assigned members yet" description="Once an administrator assigns members to you, they will appear here." icon={Users} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.members.map((m) => {
            const fit = data.fitness.members.find((f) => f.member.userId === m.member.userId);
            return (
            <article key={m.assignmentId} className="card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <Avatar name={m.member.fullName} src={m.member.profileImg} />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-ink">{m.member.fullName}</h2>
                  <p className="truncate text-xs text-faint">{m.member.email}</p>
                </div>
                {m.workoutsLast7Days > 0 ? <Badge tone="lime">Active</Badge> : <Badge>Idle</Badge>}
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-raised p-3 text-center">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">7 days</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{m.workoutsLast7Days}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">30 days</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{m.workoutsLast30Days}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">Weight</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{m.latestWeightKg ?? '—'}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <p className="mb-1 text-xs text-muted">Plan completion · last 7 days</p>
                <CompletionCell percent={fit?.completionPercent ?? null} label={`${m.member.fullName} plan completion`} />
                <p className="mt-1.5 text-xs text-faint">
                  {fit?.activeGoals ?? 0} active goal{fit?.activeGoals === 1 ? '' : 's'}
                  {fit?.goalsBehind ? ` · ${fit.goalsBehind} behind` : ''} · {fit?.feedbackSent ?? 0} feedback sent
                </p>
              </div>
              <p className="mt-3 text-xs text-faint">
                Last workout {formatDate(m.lastWorkoutDate)} · Assigned {formatDateTime(m.assignedAt)} · {m.planCount} plan{m.planCount === 1 ? '' : 's'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Link to={`/trainer/members/${m.member.userId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-lime px-3 text-xs font-semibold text-on-lime hover:bg-lime-strong">
                  <UserRound className="size-3.5" aria-hidden /> Details
                </Link>
                <Link to={`/trainer/workouts?memberId=${m.member.userId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-medium hover:border-line-strong">
                  <History className="size-3.5" aria-hidden /> Workouts
                </Link>
                <Link to={`/trainer/progress?memberId=${m.member.userId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-medium hover:border-line-strong">
                  <BarChart3 className="size-3.5" aria-hidden /> Progress
                </Link>
                <Link to={`/trainer/plans?memberId=${m.member.userId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-medium hover:border-line-strong">
                  <ClipboardList className="size-3.5" aria-hidden /> Plans
                </Link>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </>
  );
}
