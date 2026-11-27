import { ClipboardCheck, Lock, MessageSquare, Target } from 'lucide-react';
import type { AdminReport, MemberReport, TrainerReport } from '../api/types';
import { formatDate } from '../lib/format';
import { CompletionCell, GOAL_TYPE_LABEL, GoalStateBadge, ProgressBar, percentTone } from './fitness';
import { Card, EmptyState, StatCard, Table, Td, Th } from './ui';

/** Version 2.0 part of the member report (member page and trainer's single-member report). */
export function MemberFitnessReportSection({ fitness }: { fitness: MemberReport['fitness'] }) {
  const pc = fitness.planCompletion;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Workout plan completion" padded={false}>
        <div className="border-b border-line px-5 py-4">
          <ProgressBar value={pc.completionPercent} label="Plan completion in the report period" tone={percentTone(pc.completionPercent)} />
          <p className="mt-2 text-xs text-muted">
            {pc.completedExercises} completed · {pc.partialExercises} partial · {pc.pendingExercises} pending · {pc.planWorkouts} workouts from plans · {pc.otherWorkouts} other
          </p>
        </div>
        {pc.plans.length === 0 ? (
          <EmptyState title="No workout plans" icon={ClipboardCheck} />
        ) : (
          <Table
            compact
            head={
              <>
                <Th>Plan</Th>
                <Th className="text-right">Done</Th>
                <Th className="w-36">Completion</Th>
              </>
            }
          >
            {pc.plans.map((p) => (
              <tr key={p.planName}>
                <Td>
                  <span className="font-medium text-ink">{p.planName}</span>
                  {p.trainerName && <span className="block text-xs text-faint">{p.trainerName}</span>}
                </Td>
                <Td className="text-right tabular-nums">
                  {p.completedExercises} / {p.prescribedExercises}
                </Td>
                <Td>
                  <CompletionCell percent={p.completionPercent} label={`${p.planName} completion`} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Fitness goals" padded={false} action={<span className="text-xs text-faint">{fitness.feedback.receivedInPeriod} feedback received</span>}>
        {fitness.goals.length === 0 ? (
          <EmptyState title="No goals in this period" icon={Target} />
        ) : (
          <ul className="divide-y divide-line">
            {fitness.goals.map((g) => (
              <li key={`${g.goalName}-${g.startDate}`} className="px-5 py-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-ink">{g.goalName}</p>
                  {g.status === 'Active' ? <GoalStateBadge state={g.state} /> : <GoalStateBadge state={g.status === 'Completed' ? 'Achieved' : g.status} />}
                </div>
                <ProgressBar value={g.progressPercent} label={`${g.goalName} progress`} tone={percentTone(g.progressPercent)} size="sm" />
                <p className="mt-1 text-xs text-faint">
                  {GOAL_TYPE_LABEL[g.goalType]} · due {formatDate(g.targetDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function TrainerFitnessReportSection({ fitness }: { fitness: TrainerReport['fitness'] }) {
  return (
    <Card title="Plan completion, goals and feedback by member" padded={false}>
      {fitness.members.length === 0 ? (
        <EmptyState title="No assigned members" />
      ) : (
        <Table
          head={
            <>
              <Th>Member</Th>
              <Th className="w-40">Plan completion</Th>
              <Th className="text-right">Pending</Th>
              <Th className="text-right">Active goals</Th>
              <Th className="text-right">Behind</Th>
              <Th className="text-right">Feedback given</Th>
            </>
          }
        >
          {fitness.members.map((m) => (
            <tr key={m.member.userId}>
              <Td className="font-medium text-ink">{m.member.fullName}</Td>
              <Td>
                <CompletionCell percent={m.completionPercent} label={`${m.member.fullName} plan completion`} />
              </Td>
              <Td className="text-right tabular-nums">{m.pendingExercises}</Td>
              <Td className="text-right tabular-nums">{m.activeGoals}</Td>
              <Td className="text-right tabular-nums">{m.goalsBehind}</Td>
              <Td className="text-right tabular-nums">{m.feedbackGiven}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

export function AdminFitnessReportSection({ fitness }: { fitness: AdminReport['fitness'] }) {
  const c = fitness.completion;
  const g = fitness.goals;
  const f = fitness.feedback;
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg plan completion" value={pct(c.averageCompletionPercent)} hint={`${c.membersWithPlans} members with plans`} icon={ClipboardCheck} />
        <StatCard label="Goals active" value={g.byStatus.Active} hint={`${g.activeByState.onTrack} on track · ${g.activeByState.behind} behind`} icon={Target} />
        <StatCard label="Goal achievement" value={pct(g.achievementRatePercent)} hint={`${g.byStatus.Completed} completed · ${g.byStatus.Missed} missed`} icon={Target} />
        <StatCard label="Feedback in period" value={f.total} hint={`${pct(f.readRatePercent)} read by members`} icon={MessageSquare} />
      </div>
      <p className="flex items-start gap-2 text-xs text-faint">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Fitness management figures are aggregates; member names, goal names and feedback messages are not part of the system report.
      </p>
    </>
  );
}
