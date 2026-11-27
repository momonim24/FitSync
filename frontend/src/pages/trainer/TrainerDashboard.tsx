import { Activity, AlertTriangle, ClipboardCheck, ClipboardList, MessageSquare, Target, Timer, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/services';
import { ActivityChart } from '../../components/charts';
import type { TrainerDashboard as TrainerDashboardData } from '../../api/types';
import { CompletionCell, FeedbackCard, GoalStateBadge, ProgressBar, percentTone } from '../../components/fitness';
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Table, Td, Th } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, formatMinutes } from '../../lib/format';
import { DataUnavailable, FitnessSectionUnavailable } from '../../components/resilience';
import { fitnessMissing, trainerActiveGoals, trainerCriteria, trainerMembers, trainerRecentFeedback, trainerSummary } from '../../lib/fitness-guards';

export default function TrainerDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.trainer(), []);
  const fitnessMembers = trainerMembers(data?.fitness);

  return (
    <>
      <PageHeader title={`Welcome, Coach ${user?.fullName.split(' ')[0]}`} description="How your members are training this week." />

      {loading && !data ? (
        <LoadingState label="Loading dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned members" value={data.summary.assignedMembers} icon={Users} accent />
            <StatCard
              label="Active this week"
              value={`${data.summary.activeMembersLast7Days} / ${data.summary.assignedMembers}`}
              hint="Members with a workout in 7 days"
              icon={Activity}
            />
            <StatCard label="Member workouts" value={data.summary.memberWorkoutsLast7Days} hint={`${formatMinutes(data.summary.memberMinutesLast7Days)} in the last 7 days`} icon={Timer} />
            <StatCard label="Plans created" value={data.summary.plansCreated} icon={ClipboardList} />
          </div>

          <TrainerFitnessSection fitness={data.fitness} />

          <Card title="Member workouts per day — last 14 days">
            <ActivityChart data={data.activity} metric="workouts" />
          </Card>

          <Card title="My members" padded={false} action={<Link to="/trainer/members" className="text-xs font-medium text-lime hover:underline">Manage</Link>}>
            {data.members.length === 0 ? (
              <EmptyState title="No assigned members" description="An administrator assigns members to trainers." icon={Users} />
            ) : (
              <Table
                head={
                  <>
                    <Th>Member</Th>
                    <Th>Last workout</Th>
                    <Th className="text-right">7 days</Th>
                    <Th className="text-right">30 days</Th>
                    <Th className="text-right">Latest weight</Th>
                    <Th className="text-right">Plans</Th>
                    <Th className="w-40">Plan completion (7 d)</Th>
                  </>
                }
              >
                {data.members.map((m) => (
                  <tr key={m.assignmentId} className="hover:bg-raised/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.member.fullName} src={m.member.profileImg} size="sm" />
                        <div className="min-w-0">
                          <Link to={`/trainer/members/${m.member.userId}`} className="block truncate font-medium text-ink hover:text-lime">
                            {m.member.fullName}
                          </Link>
                          <p className="truncate text-xs text-faint">{m.member.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-muted">{formatDate(m.lastWorkoutDate)}</Td>
                    <Td className="text-right tabular-nums">{m.workoutsLast7Days}</Td>
                    <Td className="text-right tabular-nums">{m.workoutsLast30Days}</Td>
                    <Td className="text-right tabular-nums">{m.latestWeightKg !== null ? `${m.latestWeightKg} kg` : '—'}</Td>
                    <Td className="text-right tabular-nums">{m.planCount}</Td>
                    <Td>
                      {fitnessMembers ? (
                        <CompletionCell percent={fitnessMembers.find((f) => f.member.userId === m.member.userId)?.completionPercent ?? null} label={`${m.member.fullName} plan completion`} />
                      ) : (
                        <span className="text-xs text-faint" title="Plan completion data is unavailable">Unavailable</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Recent member workouts" padded={false} action={<Link to="/trainer/workouts" className="text-xs font-medium text-lime hover:underline">View all</Link>}>
            {data.recentWorkouts.length === 0 ? (
              <EmptyState title="No workouts yet" icon={Activity} />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentWorkouts.map((log) => (
                  <li key={log.logId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {log.member?.fullName} <span className="font-normal text-muted">· {log.exercise?.exerciseName}</span>
                      </p>
                      <p className="text-xs text-faint">{formatDate(log.workoutDate)}</p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-muted">
                      {log.sets} × {log.repetitions} · {log.durationMinutes} min
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}

/** Version 2.0: adherence, goals, members requiring attention and recent feedback. */
function TrainerFitnessSection({ fitness }: { fitness: TrainerDashboardData['fitness'] | undefined }) {
  // Each part checks its own data (QA fix H2): missing data is reported, never shown as zeros.
  if (fitnessMissing(fitness)) return <FitnessSectionUnavailable />;
  const s = trainerSummary(fitness);
  const members = trainerMembers(fitness);
  const criteria = trainerCriteria(fitness);
  const recentFeedback = trainerRecentFeedback(fitness);
  const activeGoals = trainerActiveGoals(fitness);
  const flagged = members?.filter((m) => m.attentionReasons.length > 0) ?? [];
  return (
    <>
      {!s ? (
        <Card title="Plan completion, goals and feedback summary">
          <DataUnavailable what="The fitness summary" compact />
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Avg plan completion · 7 days"
          value={s.averageCompletionPercent === null ? '—' : `${s.averageCompletionPercent}%`}
          hint={`${s.membersWithPlans} member${s.membersWithPlans === 1 ? '' : 's'} with your plans`}
          icon={ClipboardCheck}
        />
        <StatCard label="Need attention" value={s.membersRequiringAttention} hint="See the criteria below" icon={AlertTriangle} />
        <StatCard label="Active member goals" value={s.activeGoals} hint={`${s.goalsOnTrack} on track · ${s.goalsBehind} behind · ${s.goalsNoData} no data`} icon={Target} />
        <StatCard label="Feedback sent · 30 days" value={s.feedbackSentLast30Days} hint={`${s.feedbackUnreadByMembers} not read yet by members`} icon={MessageSquare} />
      </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Members requiring attention" padded={false} className="xl:col-span-3">
          {!members ? (
            <DataUnavailable what="The attention list" />
          ) : flagged.length === 0 ? (
            <EmptyState title="Everyone is on track" description="No assigned member meets an attention criterion right now." icon={ClipboardCheck} />
          ) : (
            <ul className="divide-y divide-line">
              {flagged.map((m) => (
                <li key={m.member.userId} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link to={`/trainer/members/${m.member.userId}`} className="font-medium text-ink hover:text-lime">
                      {m.member.fullName}
                    </Link>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.attentionReasons.map((r) => (
                        <li key={r}>
                          <Badge tone="warning">
                            <AlertTriangle className="size-3" aria-hidden />
                            {r}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="w-full shrink-0 sm:w-36">
                    <CompletionCell percent={m.completionPercent} label={`${m.member.fullName} plan completion`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-line px-5 py-3 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-faint hover:text-ink">How members are flagged</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {(criteria ?? []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        </Card>

        <Card title="Recent feedback" padded={false} className="xl:col-span-2" action={<Link to="/trainer/feedback" className="text-xs font-medium text-lime hover:underline">Manage</Link>}>
          {!recentFeedback ? (
            <DataUnavailable what="Recent feedback" />
          ) : recentFeedback.length === 0 ? (
            <EmptyState title="No feedback yet" description="Give your members short notes from the Feedback page." icon={MessageSquare} />
          ) : (
            <div className="divide-y divide-line">
              {recentFeedback.slice(0, 3).map((f) => (
                <FeedbackCard key={f.feedbackId} item={f} viewer="trainer" />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Member goals" padded={false} action={<Link to="/trainer/goals" className="text-xs font-medium text-lime hover:underline">All goals</Link>}>
        {!activeGoals ? (
          <DataUnavailable what="Member goal progress" />
        ) : activeGoals.length === 0 ? (
          <EmptyState title="No active member goals" icon={Target} />
        ) : (
          <Table
            head={
              <>
                <Th>Member</Th>
                <Th>Goal</Th>
                <Th>Status</Th>
                <Th className="w-44">Progress</Th>
                <Th>Due</Th>
              </>
            }
          >
            {activeGoals.slice(0, 8).map((g) => (
              <tr key={g.goalId} className="hover:bg-raised/50">
                <Td className="font-medium text-ink">{g.member?.fullName}</Td>
                <Td className="max-w-56 truncate">{g.goalName}</Td>
                <Td>
                  <GoalStateBadge state={g.progress.state} />
                </Td>
                <Td>
                  <ProgressBar value={g.progress.progressPercent} label={`${g.goalName} progress`} tone={percentTone(g.progress.progressPercent)} size="sm" />
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(g.targetDate)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
