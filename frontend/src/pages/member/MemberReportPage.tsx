import { useState } from 'react';
import { reportsApi, type ReportParams } from '../../api/services';
import { MemberReportView, RangeCaption, ReportActions, ReportFilters } from '../../components/reports';
import { ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';

/** Member: personal fitness report (GET /reports/member). */
export default function MemberReportPage() {
  const [params, setParams] = useState<ReportParams>({ period: 'month' });
  const { data, loading, error, reload } = useFetch(() => reportsApi.member(params), [params.period, params.from, params.to]);

  return (
    <>
      <PageHeader
        title="My Fitness Report"
        description="Your training statistics for the selected period."
        actions={<ReportActions csvPath="/reports/member" params={params} report={loading ? null : data} />}
      />
      <ReportFilters value={params} onChange={setParams} />
      {loading && !data ? (
        <LoadingState label="Calculating your report…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className={loading ? 'opacity-60' : ''}>
          <RangeCaption range={data.range} />
          <MemberReportView report={data} />
        </div>
      ) : null}
    </>
  );
}
