import { Activity, Link2, UserCheck, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { reportsApi, type ReportParams } from '../../api/services';
import type { AdminReport } from '../../api/types';
import { PeriodBarChart, RankedBars } from '../../components/charts';
import { RangeCaption, ReportActions, ReportFilters, SectionGrid } from '../../components/reports';
import { AdminFitnessReportSection } from '../../components/fitness-reports';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, RoleBadge, StatCard, Table, Td, Th } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { formatMinutes, formatMonth, shortDate } from '../../lib/format';

/** Admin: system-wide report (GET /reports/admin). */
export default function AdminReportPage() {
  const [params, setParams] = useState<ReportParams>({ period: 'month' });
  const { data, loading, error, reload } = useFetch(() => reportsApi.admin(params), [params.period, params.from, params.to]);

  return (
    <>
      <PageHeader
        title="System Report"
        description="Users, registrations, workout activity and trainer coverage."
        actions={<ReportActions csvPath="/reports/admin" params={params} report={loading ? null : data} />}
      />
      <ReportFilters value={params} onChange={setParams} />
      {loading && !data ? (
        <LoadingState label="Calculating report…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className={loading ? 'opacity-60' : ''}>
          <RangeCaption range={data.range} />
          <AdminReportView report={data} />
        </div>
      ) : null}
    </>
  );
}

function AdminReportView({ report }: { report: AdminReport }) {
  const fmt = report.seriesGranularity === 'month' ? formatMonth : shortDate;
  const unit = report.seriesGranularity === 'month' ? 'month' : 'day';
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={report.users.total} hint={`${report.users.active} active · ${report.users.inactive} deactivated`} icon={Users} accent />
        <StatCard label="New registrations" value={report.registrations.inRange} hint="In this period" icon={UserPlus} />
        <StatCard label="Workouts logged" value={report.activity.totalWorkouts} hint={`${formatMinutes(report.activity.totalDurationMinutes)} of training`} icon={Activity} />
        <StatCard
          label="Active members"
          value={report.activity.activeMembers}
          hint={`${report.activity.averageWorkoutsPerActiveMember} workouts each on average`}
          icon={UserCheck}
        />
      </div>

      <SectionGrid>
        <Card title={`Workouts per ${unit}`}>
          <PeriodBarChart data={report.activity.series.map((p) => ({ label: p.period, value: p.workouts }))} unit="workouts" labelFormat={fmt} />
        </Card>
        <Card title={`Registrations per ${unit}`}>
          <PeriodBarChart data={report.registrations.series.map((p) => ({ label: p.period, value: p.count }))} unit="users" labelFormat={fmt} />
        </Card>
      </SectionGrid>

      <SectionGrid>
        <Card title="Users by role" padded={false}>
          <Table compact
            head={
              <>
                <Th>Role</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Active</Th>
                <Th className="text-right">New in period</Th>
              </>
            }
          >
            {report.users.byRole.map((r) => (
              <tr key={r.role}>
                <Td>
                  <RoleBadge role={r.role} />
                </Td>
                <Td className="text-right tabular-nums">{r.total}</Td>
                <Td className="text-right tabular-nums">{r.active}</Td>
                <Td className="text-right tabular-nums">{report.registrations.byRole.find((x) => x.role === r.role)?.count ?? 0}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Most logged exercises">
          {report.topExercises.length ? (
            <RankedBars data={report.topExercises} labelKey="exerciseName" valueKey="workouts" unit="workouts" />
          ) : (
            <EmptyState title="No workouts in this period" />
          )}
        </Card>
      </SectionGrid>

      <SectionGrid>
        <Card title="Trainer assignments" padded={false}>
          {report.assignments.trainers.length === 0 ? (
            <EmptyState title="No trainer assignments" icon={Link2} />
          ) : (
            <Table compact
              head={
                <>
                  <Th>Trainer</Th>
                  <Th className="text-right">Assigned members</Th>
                </>
              }
            >
              {report.assignments.trainers.map((t) => (
                <tr key={t.trainerId}>
                  <Td className="font-medium text-ink">{t.fullName}</Td>
                  <Td className="text-right tabular-nums">{t.assignedMembers}</Td>
                </tr>
              ))}
            </Table>
          )}
          <dl className="grid grid-cols-3 gap-3 border-t border-line p-5 text-sm">
            <div>
              <dt className="text-xs text-faint">Total</dt>
              <dd className="font-display text-xl font-semibold">{report.assignments.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Avg. per trainer</dt>
              <dd className="font-display text-xl font-semibold">{report.assignments.averageMembersPerTrainer}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Members without trainer</dt>
              <dd className="font-display text-xl font-semibold">{report.assignments.unassignedActiveMembers}</dd>
            </div>
          </dl>
        </Card>
        <Card title="System usage in period" padded={false}>
          <Table compact
            head={
              <>
                <Th>Metric</Th>
                <Th className="text-right">Value</Th>
              </>
            }
          >
            {[
              ['Workout logs recorded', report.usage.workoutLogs],
              ['Progress records', report.usage.progressRecords],
              ['Workout plans created', report.usage.workoutPlansCreated],
              ['Trainer assignments created', report.assignments.createdInRange],
              ['Exercises imported from wger', report.usage.exercisesImported],
              ['Members with activity', report.usage.activeUsers],
            ].map(([label, value]) => (
              <tr key={label}>
                <Td className="text-muted">{label}</Td>
                <Td className="text-right font-medium tabular-nums">{value}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </SectionGrid>
      {report.fitness && <AdminFitnessReportSection fitness={report.fitness} />}
    </div>
  );
}
