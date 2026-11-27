import { Activity, ClipboardList, Dumbbell, Link2, Lock, UserCheck, Users } from 'lucide-react';
import type { AdminDashboard as AdminDashboardData } from '../../api/types';
import { GOAL_TYPE_LABEL, ProgressBar, percentTone } from '../../components/fitness';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/services';
import { ActivityChart, RankedBars } from '../../components/charts';
import { Avatar, Card, EmptyState, ErrorState, LoadingState, PageHeader, RoleBadge, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { formatDateTime, formatMonth } from '../../lib/format';
import { DataUnavailable, FitnessSectionUnavailable } from '../../components/resilience';
import { adminCompletion, adminFeedback, adminGoals, fitnessMissing } from '../../lib/fitness-guards';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => dashboardApi.admin(), []);

  return (
    <>
      <PageHeader title="Administration" description="System-wide statistics computed from the FitSync database." />
      {loading && !data ? (
        <LoadingState label="Loading statistics…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Users" value={data.users.total} hint={`${data.users.members} members · ${data.users.trainers} trainers · ${data.users.admins} admin${data.users.admins === 1 ? "" : "s"}`} icon={Users} accent />
            <StatCard label="Active accounts" value={data.users.active} hint={`${data.users.inactive} deactivated`} icon={UserCheck} />
            <StatCard label="Workout logs" value={data.totals.workoutLogs} hint={`${data.totals.progressRecords} progress records`} icon={Activity} />
            <StatCard label="Exercises" value={data.totals.exercises} hint={`${data.totals.workoutPlans} workout plans`} icon={Dumbbell} />
          </div>

          <AdminFitnessSection fitness={data.fitness} />

          <div className="grid gap-6 xl:grid-cols-5">
            <Card title="Workouts logged per day — last 14 days" className="xl:col-span-3">
              <ActivityChart data={data.activity} metric="workouts" />
            </Card>
            <Card title="Most logged exercises" className="xl:col-span-2">
              {data.topExercises.length ? <RankedBars data={data.topExercises} labelKey="exerciseName" valueKey="count" unit="logs" /> : <EmptyState title="No workouts yet" />}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Trainer coverage">
              <dl className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted">
                    <Link2 className="size-4 text-lime" aria-hidden /> Trainer assignments
                  </dt>
                  <dd className="font-display text-xl font-semibold">{data.totals.trainerAssignments}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted">
                    <Users className="size-4 text-warning" aria-hidden /> Members without a trainer
                  </dt>
                  <dd className="font-display text-xl font-semibold">{data.totals.unassignedMembers}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted">
                    <ClipboardList className="size-4 text-lime" aria-hidden /> Workout plans
                  </dt>
                  <dd className="font-display text-xl font-semibold">{data.totals.workoutPlans}</dd>
                </div>
              </dl>
              <Link to="/admin/assignments" className="mt-5 inline-block text-xs font-medium text-lime hover:underline">
                Manage assignments
              </Link>
            </Card>
            <Card title="Exercises by category">
              {data.exercisesByCategory.length ? <RankedBars data={data.exercisesByCategory} labelKey="category" valueKey="count" unit="exercises" /> : <EmptyState title="No exercises" />}
            </Card>
            <Card title="New registrations (6 months)">
              {data.registrations.length ? (
                <RankedBars data={data.registrations.map((r) => ({ month: formatMonth(r.month), count: r.count }))} labelKey="month" valueKey="count" unit="users" />
              ) : (
                <EmptyState title="No registrations" />
              )}
            </Card>
          </div>

          <Card title="Newest accounts" padded={false} action={<Link to="/admin/users" className="text-xs font-medium text-lime hover:underline">Manage users</Link>}>
            <ul className="divide-y divide-line">
              {data.recentUsers.map((u) => (
                <li key={u.userId} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.fullName} src={u.profileImg} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.fullName}</p>
                    <p className="truncate text-xs text-faint">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                  <span className="hidden text-xs text-faint sm:inline">{formatDateTime(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/** Version 2.0: aggregate completion, goal and feedback statistics (no names, no message content). */
function AdminFitnessSection({ fitness }: { fitness: AdminDashboardData['fitness'] | undefined }) {
  // Each card checks its own data (QA fix H2): missing data is reported, never shown as zeros.
  if (fitnessMissing(fitness)) return <FitnessSectionUnavailable />;
  const c = adminCompletion(fitness);
  const g = adminGoals(fitness);
  const f = adminFeedback(fitness);
  const row = (label: string, value: string | number) => (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <Card title="Workout plan completion · 30 days">
        {!c ? <DataUnavailable what="Plan completion statistics" compact /> : (<>
        <ProgressBar value={c.averageCompletionPercent} label="Average plan completion across members" tone={percentTone(c.averageCompletionPercent)} />
        <p className="mt-2 text-xs text-faint">Average across {c.membersWithPlans} member{c.membersWithPlans === 1 ? '' : 's'} with prescribed exercises</p>
        <dl className="mt-4 space-y-2.5 text-sm">
          {row('Prescribed exercises', c.prescribedExercises)}
          {row('Completed', c.completedExercises)}
          {row('Partially completed', c.partialExercises)}
          {row('Pending', c.pendingExercises)}
          {row('Workouts logged from plans', c.planWorkouts)}
          {row('Other workouts', c.otherWorkouts)}
        </dl>
        </>)}
      </Card>

      <Card title="Fitness goals">
        {!g ? <DataUnavailable what="Goal statistics" compact /> : (<>
        <dl className="space-y-2.5 text-sm">
          {row('Total goals', g.total)}
          {row('Active', `${g.byStatus.Active} (${g.activeByState.onTrack} on track · ${g.activeByState.behind} behind)`)}
          {row('Completed', g.byStatus.Completed)}
          {row('Missed', g.byStatus.Missed)}
          {row('Cancelled', g.byStatus.Cancelled)}
          {row('Achievement rate', pct(g.achievementRatePercent))}
          {row('Average active progress', pct(g.averageActiveProgressPercent))}
          {row('Members with active goals', g.membersWithActiveGoals)}
        </dl>
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
          {g.byType.map((t) => (
            <li key={t.goalType} className="flex justify-between">
              <span>{GOAL_TYPE_LABEL[t.goalType]}</span>
              <span className="tabular-nums">
                {t.total} total · {t.active} active · {t.completed} completed
              </span>
            </li>
          ))}
        </ul>
        </>)}
      </Card>

      <Card title="Trainer feedback" className="lg:col-span-2 xl:col-span-1">
        {!f ? <DataUnavailable what="Feedback statistics" compact /> : (<>
        <dl className="space-y-2.5 text-sm">
          {row('Feedback given', f.total)}
          {row('In the last 30 days', f.last30Days)}
          {row('Read by members', `${f.read} (${pct(f.readRatePercent)})`)}
          {row('Trainers giving feedback', f.trainersGivingFeedback)}
          {row('Members receiving feedback', f.membersReceivingFeedback)}
          {row('About goals / plans', `${f.aboutGoals} / ${f.aboutPlans}`)}
        </dl>
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
          {f.byType.map((t) => (
            <li key={t.feedbackType} className="flex justify-between">
              <span>{t.feedbackType}</span>
              <span className="tabular-nums">{t.count}</span>
            </li>
          ))}
        </ul>
        </>)}
        <p className="mt-4 flex items-start gap-2 text-xs text-faint">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Message content stays private between trainer and member; administrators see counts only.
        </p>
      </Card>
    </div>
  );
}
