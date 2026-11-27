import { Activity, ArrowLeft, BarChart3, ClipboardCheck, ClipboardList, FileBarChart, History, MessageSquare, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { completionsApi, goalsApi } from '../../api/services';
import { CompletionCell, GoalCard, PeriodToggle, type CompletionWindow } from '../../components/fitness';
import { FeedbackComposer, FeedbackHistory } from '../../components/trainer-feedback';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Table, Td, Th } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/format';

/** Trainer: one assigned member — plan adherence, goals and feedback in one place. */
export default function TrainerMemberDetailPage() {
  const { memberId: param } = useParams();
  const memberId = Number(param);
  const location = useLocation();
  const [period, setPeriod] = useState<CompletionWindow>('week');
  const [version, setVersion] = useState(0);
  const adherence = useFetch(() => completionsApi.adherence({ memberId, period }), [memberId, period]);
  const goals = useFetch(() => goalsApi.list({ memberId, status: 'Active', limit: 20 }), [memberId]);
  const row = adherence.data?.members[0];

  useEffect(() => {
    if (location.hash === '#feedback' && row) document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash, row]);

  if (adherence.loading && !adherence.data) return <LoadingState label="Loading member…" />;
  if (adherence.error) return <ErrorState message={adherence.error} onRetry={adherence.reload} />;
  if (!row) return <ErrorState message="This member is not assigned to you." />;

  const linkClass = 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 text-xs font-medium hover:border-line-strong';

  return (
    <>
      <Link to="/trainer/members" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> My members
      </Link>
      <PageHeader
        title={row.member.fullName}
        description={row.member.email}
        actions={
          <>
            <Link to={`/trainer/workouts?memberId=${memberId}`} className={linkClass}>
              <History className="size-3.5" aria-hidden /> Workouts
            </Link>
            <Link to={`/trainer/progress?memberId=${memberId}`} className={linkClass}>
              <BarChart3 className="size-3.5" aria-hidden /> Progress
            </Link>
            <Link to={`/trainer/plans?memberId=${memberId}`} className={linkClass}>
              <ClipboardList className="size-3.5" aria-hidden /> Plans
            </Link>
            <Link to={`/trainer/reports?memberId=${memberId}`} className={linkClass}>
              <FileBarChart className="size-3.5" aria-hidden /> Report
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`Plan completion · ${period === 'week' ? '7' : '30'} days`}
            value={row.completionPercent === null ? '—' : `${row.completionPercent}%`}
            hint={row.prescribedExercises ? `${row.completedExercises} of ${row.prescribedExercises} exercises completed` : 'No exercises prescribed by you'}
            icon={ClipboardCheck}
            accent
          />
          <StatCard label="Workouts in period" value={row.workoutsInPeriod} hint={`${row.planWorkouts} from plans · ${row.otherWorkouts} other`} icon={Activity} />
          <StatCard label="Last workout" value={formatDate(row.lastWorkoutDate)} icon={History} />
          <StatCard label="Active goals" value={goals.data?.total ?? '—'} icon={Target} />
        </div>

        <Card title="Prescribed vs completed" padded={false} action={<PeriodToggle value={period} onChange={setPeriod} />}>
          {row.plans.length === 0 ? (
            <EmptyState title="No plans from you yet" description="Create a workout plan for this member to track completion." icon={ClipboardList} />
          ) : (
            <Table
              head={
                <>
                  <Th>Plan</Th>
                  <Th className="text-right">Completed</Th>
                  <Th className="text-right">Partial</Th>
                  <Th className="text-right">Pending</Th>
                  <Th className="w-48">Completion</Th>
                </>
              }
            >
              {row.plans.map((p) => (
                <tr key={p.planId} className="hover:bg-raised/50">
                  <Td>
                    <Link to={`/trainer/plans/${p.planId}`} className="font-medium text-ink hover:text-lime">
                      {p.planName}
                    </Link>
                    <p className="text-xs text-faint">{p.prescribedExercises} prescribed · open for exercise detail</p>
                  </Td>
                  <Td className="text-right tabular-nums">{p.completedExercises}</Td>
                  <Td className="text-right tabular-nums">{p.partialExercises}</Td>
                  <Td className="text-right tabular-nums">{p.pendingExercises}</Td>
                  <Td>
                    <CompletionCell percent={p.completionPercent} label={`${p.planName} completion`} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <section aria-labelledby="goals-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="goals-heading" className="text-lg font-semibold text-ink">
              Active goals
            </h2>
            <Link to={`/trainer/goals`} className="text-xs font-medium text-lime hover:underline">
              All member goals
            </Link>
          </div>
          {goals.loading && !goals.data ? (
            <LoadingState label="Loading goals…" />
          ) : goals.error ? (
            <ErrorState message={goals.error} onRetry={goals.reload} />
          ) : !goals.data?.items.length ? (
            <div className="card">
              <EmptyState title="No active goals" description="The member has not set a goal yet." icon={Target} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {goals.data.items.map((g) => (
                <GoalCard key={g.goalId} goal={g} />
              ))}
            </div>
          )}
        </section>

        <div id="feedback" className="grid scroll-mt-24 items-start gap-6 xl:grid-cols-5">
          <Card title="Write feedback" className="xl:col-span-2">
            <FeedbackComposer fixedMember={row.member} onSent={() => setVersion((v) => v + 1)} />
          </Card>
          <Card title="Feedback history" padded={false} className="xl:col-span-3" action={<MessageSquare className="size-4 text-faint" aria-hidden />}>
            <FeedbackHistory memberId={memberId} version={version} onChanged={() => setVersion((v) => v + 1)} />
          </Card>
        </div>

        {row.prescribedExercises > 0 && (
          <p className="text-xs text-faint">Overall completion combines all your plans for this member; every prescribed exercise weighs the same.</p>
        )}
      </div>
    </>
  );
}
