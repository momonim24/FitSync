import { Activity, ClipboardCheck, Flame, MessageSquare, Plus, Scale, Target, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/services';
import { ActivityChart, RankedBars, WeightChart } from '../../components/charts';
import type { MemberDashboard as MemberDashboardData } from '../../api/types';
import { FeedbackCard, GoalStateBadge, ProgressBar, goalCurrentText, percentTone } from '../../components/fitness';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from '../../components/ui';
import { WorkoutLogModal } from '../../components/WorkoutLogModal';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, formatMinutes } from '../../lib/format';
import { DataUnavailable, FitnessSectionUnavailable } from '../../components/resilience';
import { fitnessMissing, memberActiveGoals, memberFeedback, memberPlanCompletion } from '../../lib/fitness-guards';

export default function MemberDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.member(), []);
  const [logOpen, setLogOpen] = useState(false);

  const firstName = user?.fullName.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hi, ${firstName}`}
        description="Your training at a glance."
        actions={
          <Button icon={Plus} onClick={() => setLogOpen(true)}>
            Record workout
          </Button>
        }
      />

      {loading && !data ? (
        <LoadingState label="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Workouts this week" value={data.summary.workoutsThisWeek} hint={`${data.summary.totalWorkouts} logged in total`} icon={Activity} accent />
            <StatCard label="Time this week" value={formatMinutes(data.summary.minutesThisWeek)} hint={`${formatMinutes(data.summary.totalMinutes)} all time`} icon={Timer} />
            <StatCard
              label="Current streak"
              value={`${data.summary.currentStreakDays} day${data.summary.currentStreakDays === 1 ? '' : 's'}`}
              hint="Consecutive days with a workout"
              icon={Flame}
            />
            <StatCard
              label="Latest weight"
              value={data.summary.latestWeightKg !== null ? `${data.summary.latestWeightKg} kg` : '—'}
              hint={
                data.summary.weightChangeKg !== null
                  ? `${data.summary.weightChangeKg > 0 ? '+' : ''}${data.summary.weightChangeKg} kg since first record`
                  : 'No weight recorded yet'
              }
              icon={Scale}
            />
          </div>

          <MemberFitnessRow fitness={data.fitness} />

          <div className="grid gap-6 xl:grid-cols-5">
            <Card title="Minutes trained — last 14 days" className="xl:col-span-3">
              <ActivityChart data={data.activity} />
            </Card>
            <Card title="Weight trend" className="xl:col-span-2" action={<Link to="/member/progress" className="text-xs font-medium text-lime hover:underline">View all</Link>}>
              {data.weightTrend.length >= 2 ? (
                <WeightChart data={data.weightTrend} />
              ) : (
                <EmptyState title="Not enough data yet" description="Add at least two weight records to see your trend." icon={Scale} />
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card title="Recent workouts" className="xl:col-span-3" padded={false} action={<Link to="/member/workouts" className="text-xs font-medium text-lime hover:underline">View all</Link>}>
              {data.recentWorkouts.length === 0 ? (
                <EmptyState title="No workouts yet" description="Record your first workout to start tracking." icon={Activity} />
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentWorkouts.map((log) => (
                    <li key={log.logId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{log.exercise?.exerciseName}</p>
                        <p className="text-xs text-faint">{formatDate(log.workoutDate)} · {log.exercise?.category}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm tabular-nums text-muted">
                        {log.sets} × {log.repetitions} · {log.durationMinutes} min
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-6 xl:col-span-2">
              <Card title="Workouts by category">
                {data.categoryBreakdown.length ? (
                  <RankedBars data={data.categoryBreakdown} labelKey="category" valueKey="count" unit="workouts" />
                ) : (
                  <EmptyState title="No workouts yet" />
                )}
              </Card>
              <Card title="My trainers">
                {data.trainers.length === 0 ? (
                  <p className="text-sm text-muted">No trainer assigned yet. An administrator can assign one to you.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.trainers.map((trainer) => (
                      <li key={trainer.userId} className="flex items-center gap-3">
                        <Avatar name={trainer.fullName} src={trainer.profileImg} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{trainer.fullName}</p>
                          <p className="truncate text-xs text-faint">{trainer.email}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      <WorkoutLogModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => reload()} />
    </>
  );
}

/** Version 2.0: plan completion, active goals and recent trainer feedback. */
function MemberFitnessRow({ fitness }: { fitness: MemberDashboardData['fitness'] | undefined }) {
  // Each card checks its own data (QA fix H2): missing data is reported, never shown as zeros.
  if (fitnessMissing(fitness)) return <FitnessSectionUnavailable />;
  const pc = memberPlanCompletion(fitness);
  const activeGoals = memberActiveGoals(fitness);
  const feedback = memberFeedback(fitness);
  const link = (to: string, text: string) => (
    <Link to={to} className="text-xs font-medium text-lime hover:underline">
      {text}
    </Link>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <Card title="Plan completion — last 7 days" action={link('/member/plans', 'Open plans')}>
        {!pc ? (
          <DataUnavailable what="Plan completion" compact />
        ) : pc.prescribedExercises === 0 ? (
          <EmptyState title="No plan exercises yet" description="When your trainer prescribes exercises, completion appears here." icon={ClipboardCheck} />
        ) : (
          <>
            <ProgressBar value={pc.completionPercent} label="Overall plan completion" tone={percentTone(pc.completionPercent)} />
            <p className="mt-2 text-xs text-muted">
              {pc.completedExercises} completed · {pc.partialExercises} partial · {pc.pendingExercises} pending of {pc.prescribedExercises} prescribed
            </p>
            <ul className="mt-4 space-y-3">
              {pc.plans.map((p) => (
                <li key={p.planId}>
                  <p className="mb-1 truncate text-sm text-ink">{p.planName}</p>
                  <ProgressBar value={p.completionPercent} label={`${p.planName} completion`} tone={percentTone(p.completionPercent)} size="sm" />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Active goals" action={link('/member/goals', 'Manage goals')}>
        {!activeGoals ? (
          <DataUnavailable what="Goal progress" compact />
        ) : activeGoals.length === 0 ? (
          <EmptyState title="No active goals" description="Set a weight, weekly workout or weekly minutes goal." icon={Target} action={link('/member/goals', 'Create a goal')} />
        ) : (
          <ul className="space-y-4">
            {activeGoals.slice(0, 4).map((g) => (
              <li key={g.goalId}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{g.goalName}</p>
                  <GoalStateBadge state={g.progress.state} />
                </div>
                <ProgressBar value={g.progress.progressPercent} label={`${g.goalName} progress`} tone={percentTone(g.progress.progressPercent)} size="sm" />
                <p className="mt-1 text-xs text-faint">
                  {goalCurrentText(g)} · due {formatDate(g.targetDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Trainer feedback"
        className="lg:col-span-2 xl:col-span-1"
        padded={false}
        action={
          <span className="flex items-center gap-2">
            {feedback && feedback.unread > 0 && <Badge tone="lime">{feedback.unread} new</Badge>}
            {link('/member/feedback', 'View all')}
          </span>
        }
      >
        {!feedback ? (
          <DataUnavailable what="Trainer feedback" />
        ) : feedback.recent.length === 0 ? (
          <EmptyState title="No feedback yet" description="Notes from your trainer will appear here." icon={MessageSquare} />
        ) : (
          <div className="divide-y divide-line">
            {feedback.recent.slice(0, 3).map((f) => (
              <FeedbackCard key={f.feedbackId} item={f} viewer="member" />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
