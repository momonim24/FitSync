import { Scale, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { progressApi } from '../../api/services';
import { WeightChart } from '../../components/charts';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Table, Td, Th } from '../../components/ui';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/format';

/** Trainer: read-only progress records of one assigned member. */
export default function MemberProgressPage() {
  const [params, setParams] = useSearchParams();
  const { members, loading: loadingMembers } = useAssignedMembers();
  const memberId = params.get('memberId') ?? '';

  // Default to the first assigned member.
  useEffect(() => {
    if (!memberId && members.length) setParams({ memberId: String(members[0].userId) }, { replace: true });
  }, [memberId, members, setParams]);

  const { data, loading, error, reload } = useFetch(
    () => (memberId ? progressApi.list({ memberId, limit: 50 }) : Promise.resolve(null)),
    [memberId],
  );
  const chart = (data?.items ?? [])
    .filter((r) => r.weightKg !== null)
    .map((r) => ({ date: r.recordDate, weightKg: r.weightKg as number }))
    .reverse();

  return (
    <>
      <PageHeader title="Member Progress" description="Body-weight trend and notes recorded by your members." />

      {loadingMembers ? (
        <LoadingState />
      ) : members.length === 0 ? (
        <div className="card">
          <EmptyState title="No assigned members" description="Progress becomes visible once members are assigned to you." icon={Users} />
        </div>
      ) : (
        <div className="space-y-6">
          <label className="block max-w-xs">
            <span className="label">Member</span>
            <select className="field" value={memberId} onChange={(e) => setParams({ memberId: e.target.value })}>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>

          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <>
              <Card title="Weight trend">
                {chart.length >= 2 ? <WeightChart data={chart} /> : <EmptyState title="Not enough weight data" description="This member needs at least two weight records." icon={Scale} />}
              </Card>
              <Card title="Progress records" padded={false}>
                {!data?.items.length ? (
                  <EmptyState title="No progress records yet" icon={Scale} />
                ) : (
                  <Table
                    head={
                      <>
                        <Th>Date</Th>
                        <Th className="text-right">Weight</Th>
                        <Th>Notes</Th>
                      </>
                    }
                  >
                    {data.items.map((r) => (
                      <tr key={r.progressId} className="hover:bg-raised/50">
                        <Td className="whitespace-nowrap text-muted">{formatDate(r.recordDate)}</Td>
                        <Td className="text-right font-medium tabular-nums">{r.weightKg !== null ? `${r.weightKg} kg` : '—'}</Td>
                        <Td className="text-muted">{r.notes || '—'}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
