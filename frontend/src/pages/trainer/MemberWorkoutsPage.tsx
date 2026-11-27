import { History } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logsApi } from '../../api/services';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Table, Td, Th } from '../../components/ui';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/format';

/** Trainer: workout history of assigned members (GET /workout-logs?memberId=). */
export default function MemberWorkoutsPage() {
  const [params, setParams] = useSearchParams();
  const memberId = params.get('memberId') ?? '';
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const { members } = useAssignedMembers();

  const { data, loading, error, reload } = useFetch(() => logsApi.list({ memberId, ...range, page, limit: 15 }), [memberId, range.from, range.to, page]);

  return (
    <>
      <PageHeader title="Member Workouts" description="Workout history recorded by your assigned members." />
      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label>
            <span className="label">Member</span>
            <select
              className="field"
              value={memberId}
              onChange={(e) => {
                setPage(1);
                setParams(e.target.value ? { memberId: e.target.value } : {});
              }}
            >
              <option value="">All my members</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">From</span>
            <input type="date" className="field" value={range.from} onChange={(e) => (setRange({ ...range, from: e.target.value }), setPage(1))} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="field" value={range.to} onChange={(e) => (setRange({ ...range, to: e.target.value }), setPage(1))} />
          </label>
          <Button variant="ghost" disabled={!range.from && !range.to} onClick={() => setRange({ from: '', to: '' })}>
            Clear dates
          </Button>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading workouts…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No workouts found" description="Your members have not logged workouts for this selection." icon={History} />
        ) : data ? (
          <>
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                head={
                  <>
                    <Th>Date</Th>
                    <Th>Member</Th>
                    <Th>Exercise</Th>
                    <Th className="text-right">Sets × Reps</Th>
                    <Th className="text-right">Duration</Th>
                  </>
                }
              >
                {data.items.map((log) => (
                  <tr key={log.logId} className="hover:bg-raised/50">
                    <Td className="whitespace-nowrap text-muted">{formatDate(log.workoutDate)}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        {log.member && <Avatar name={log.member.fullName} size="sm" />}
                        <span className="font-medium">{log.member?.fullName}</span>
                      </span>
                    </Td>
                    <Td>
                      {log.exercise?.exerciseName} <Badge>{log.exercise?.category}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {log.sets} × {log.repetitions}
                    </Td>
                    <Td className="text-right tabular-nums">{log.durationMinutes} min</Td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>
    </>
  );
}
