import { Activity, CalendarCheck, ClipboardList, Timer, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsApi, type ReportParams } from '../../api/services';
import type { TrainerReport } from '../../api/types';
import { ActivityChart, RankedBars } from '../../components/charts';
import { MemberReportView, RangeCaption, ReportActions, ReportFilters, SectionGrid } from '../../components/reports';
import { TrainerFitnessReportSection } from '../../components/fitness-reports';
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Table, Td, Th } from '../../components/ui';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, formatMinutes } from '../../lib/format';

/** Trainer: comparison of assigned members, or one member's full report. */
export default function TrainerReportPage() {
  const [params, setParams] = useState<ReportParams>({ period: 'month' });
  const [search, setSearch] = useSearchParams();
  const memberId = search.get('memberId') ?? '';
  const { members } = useAssignedMembers();

  const overview = useFetch(() => (memberId ? Promise.resolve(null) : reportsApi.trainer(params)), [memberId, params.period, params.from, params.to]);
  const single = useFetch(
    () => (memberId ? reportsApi.trainerMember(Number(memberId), params) : Promise.resolve(null)),
    [memberId, params.period, params.from, params.to],
  );
  const active = memberId ? single : overview;
  const csvPath = memberId ? `/reports/trainer/members/${memberId}` : '/reports/trainer';

  return (
    <>
      <PageHeader
        title="Member Reports"
        description="Activity and progress of the members assigned to you."
        actions={<ReportActions csvPath={csvPath} params={params} report={active.loading ? null : active.data} memberViewedByTrainer={Boolean(memberId)} />}
      />

      <label className="mb-4 block max-w-sm">
        <span className="label">Report for</span>
        <select className="field" value={memberId} onChange={(e) => setSearch(e.target.value ? { memberId: e.target.value } : {})}>
          <option value="">All my members (comparison)</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))}
        </select>
      </label>
      <ReportFilters value={params} onChange={setParams} />

      {active.loading && !active.data ? (
        <LoadingState label="Calculating report…" />
      ) : active.error ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : memberId && single.data ? (
        <div className={single.loading ? 'opacity-60' : ''}>
          <RangeCaption range={single.data.range} />
          <MemberReportView report={single.data} />
        </div>
      ) : overview.data ? (
        <div className={overview.loading ? 'opacity-60' : ''}>
          <RangeCaption range={overview.data.range} />
          <ComparisonView report={overview.data} onOpen={(id) => setSearch({ memberId: String(id) })} />
        </div>
      ) : null}
    </>
  );
}

function ComparisonView({ report, onOpen }: { report: TrainerReport; onOpen: (memberId: number) => void }) {
  const s = report.summary;
  if (report.members.length === 0) {
    return (
      <div className="card">
        <EmptyState title="No assigned members" description="Reports become available once an administrator assigns members to you." icon={Users} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active members" value={`${s.activeMembers} / ${s.assignedMembers}`} hint="With at least one workout" icon={Users} accent />
        <StatCard label="Member workouts" value={s.totalWorkouts} hint={`${s.averageWorkoutsPerMember} per member`} icon={Activity} />
        <StatCard label="Training time" value={formatMinutes(s.totalDurationMinutes)} icon={Timer} />
        <StatCard label="Avg. consistency" value={`${s.averageConsistencyPercent}%`} hint={`${s.plansCreatedInRange} plan(s) created in period`} icon={CalendarCheck} />
      </div>

      <SectionGrid>
        <Card title="Member workouts per day">
          <ActivityChart data={report.daily} metric="workouts" />
        </Card>
        <Card title="Workouts per member">
          <RankedBars data={report.members.map((m) => ({ name: m.member.fullName, workouts: m.totalWorkouts }))} labelKey="name" valueKey="workouts" unit="workouts" />
        </Card>
      </SectionGrid>

      <Card title="Member comparison" padded={false}>
        <Table
          head={
            <>
              <Th>Member</Th>
              <Th className="text-right">Workouts</Th>
              <Th className="text-right">Minutes</Th>
              <Th className="text-right">Days</Th>
              <Th className="text-right">Consistency</Th>
              <Th>Last workout</Th>
              <Th className="text-right">Weight Δ</Th>
              <Th className="text-right">Plans</Th>
              <Th className="w-24" />
            </>
          }
        >
          {report.members.map((m) => (
            <tr key={m.member.userId}>
              <Td>
                <span className="flex items-center gap-2.5">
                  <Avatar name={m.member.fullName} size="sm" />
                  <span className="font-medium text-ink">{m.member.fullName}</span>
                </span>
              </Td>
              <Td className="text-right tabular-nums">{m.totalWorkouts}</Td>
              <Td className="text-right tabular-nums">{m.totalDurationMinutes}</Td>
              <Td className="text-right tabular-nums">{m.distinctWorkoutDays}</Td>
              <Td className="text-right tabular-nums">{m.consistencyPercent}%</Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(m.lastWorkoutDate)}</Td>
              <Td className="text-right tabular-nums">{m.weightChangeKg === null ? '—' : `${m.weightChangeKg > 0 ? '+' : ''}${m.weightChangeKg} kg`}</Td>
              <Td className="text-right tabular-nums">{m.planCount}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="secondary" icon={ClipboardList} onClick={() => onOpen(m.member.userId)} aria-label={`Open report for ${m.member.fullName}`}>
                  Report
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="text-xs text-faint">Weight Δ needs at least two weight records in the period.</p>
      {report.fitness && <TrainerFitnessReportSection fitness={report.fitness} />}
    </div>
  );
}
