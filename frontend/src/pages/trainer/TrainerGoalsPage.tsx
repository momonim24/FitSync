import { MessageSquarePlus, Target } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { goalsApi } from '../../api/services';
import type { FitnessGoal, GoalStatus } from '../../api/types';
import { GoalCard, GoalWeeks } from '../../components/fitness';
import { Button, EmptyState, ErrorState, LoadingState, Modal, PageHeader, Pagination } from '../../components/ui';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';
import { useFetch } from '../../hooks/useFetch';
import { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';

/** Trainer: monitor the fitness goals of assigned members (read-only; members own their goals). */
export default function TrainerGoalsPage() {
  const toast = useToast();
  const { members } = useAssignedMembers();
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState<GoalStatus | ''>('Active');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(
    () => goalsApi.list({ memberId: memberId || undefined, status: status || undefined, page, limit: 12 }),
    [memberId, status, page],
  );
  const [details, setDetails] = useState<FitnessGoal | null>(null);

  async function openDetails(goal: FitnessGoal) {
    try {
      setDetails(await goalsApi.get(goal.goalId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Member Goals" description="Goals your assigned members have set, with progress measured from their logs and weight records." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:w-2/3">
        <select aria-label="Filter goals by member" className="field" value={memberId} onChange={(e) => (setMemberId(e.target.value), setPage(1))}>
          <option value="">All assigned members</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))}
        </select>
        <select aria-label="Filter goals by status" className="field" value={status} onChange={(e) => (setStatus(e.target.value as GoalStatus | ''), setPage(1))}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Missed">Missed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading goals…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No goals found" description="Members create their own goals; they appear here for their assigned trainer." icon={Target} />
        </div>
      ) : data ? (
        <>
          <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((goal) => (
              <GoalCard
                key={goal.goalId}
                goal={goal}
                showMember
                actions={
                  <>
                    {goal.goalType !== 'TargetWeight' && (
                      <Button size="sm" variant="ghost" onClick={() => openDetails(goal)}>
                        Week by week
                      </Button>
                    )}
                    <Link
                      to={`/trainer/members/${goal.memberId}#feedback`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-medium hover:border-line-strong"
                    >
                      <MessageSquarePlus className="size-3.5" aria-hidden /> Give feedback
                    </Link>
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

      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={details ? `${details.goalName} — ${details.member?.fullName ?? ''}` : 'Goal'} size="lg">
        {details && <GoalWeeks goal={details} />}
      </Modal>
    </>
  );
}
