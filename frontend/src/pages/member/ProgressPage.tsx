import { Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { progressApi } from '../../api/services';
import type { ProgressRecord } from '../../api/types';
import { WeightChart } from '../../components/charts';
import { ProgressModal } from '../../components/ProgressModal';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, LoadingState, PageHeader, Pagination, Table, Td, Th } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/format';

/** Member: record and monitor own fitness progress. */
export default function ProgressPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProgressRecord | null>(null);
  const [deleting, setDeleting] = useState<ProgressRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const table = useFetch(() => progressApi.list({ page, limit: 10 }), [page]);
  // Chart uses the latest 30 records, oldest first.
  const trend = useFetch(() => progressApi.list({ limit: 30 }), []);

  const reloadAll = () => {
    table.reload();
    trend.reload();
  };

  const chartData = (trend.data?.items ?? [])
    .filter((r) => r.weightKg !== null)
    .map((r) => ({ date: r.recordDate, weightKg: r.weightKg as number }))
    .reverse();

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await progressApi.remove(deleting.progressId);
      toast.success('Progress record deleted.');
      setDeleting(null);
      reloadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Progress"
        description="Track your body weight and training notes over time."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add record
          </Button>
        }
      />

      <div className="space-y-6">
        <Card title="Weight trend">
          {trend.loading && !trend.data ? (
            <LoadingState />
          ) : trend.error ? (
            <ErrorState message={trend.error} onRetry={trend.reload} />
          ) : chartData.length >= 2 ? (
            <WeightChart data={chartData} />
          ) : (
            <EmptyState title="Not enough data yet" description="Add at least two records with a weight to see your trend." icon={Scale} />
          )}
        </Card>

        <Card title="All records" padded={false}>
          {table.loading && !table.data ? (
            <LoadingState />
          ) : table.error ? (
            <ErrorState message={table.error} onRetry={table.reload} />
          ) : table.data && table.data.items.length === 0 ? (
            <EmptyState title="No progress records yet" description="Add your first record to start monitoring your progress." icon={Scale} />
          ) : table.data ? (
            <>
              <Table
                head={
                  <>
                    <Th>Date</Th>
                    <Th className="text-right">Weight</Th>
                    <Th>Notes</Th>
                    <Th className="w-28 text-right">Actions</Th>
                  </>
                }
              >
                {table.data.items.map((record) => (
                  <tr key={record.progressId} className="hover:bg-raised/50">
                    <Td className="whitespace-nowrap text-muted">{formatDate(record.recordDate)}</Td>
                    <Td className="text-right font-medium tabular-nums">{record.weightKg !== null ? `${record.weightKg} kg` : '—'}</Td>
                    <Td className="max-w-md text-muted">{record.notes || '—'}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <IconButton
                        icon={Pencil}
                        label={`Edit record from ${record.recordDate}`}
                        onClick={() => {
                          setEditing(record);
                          setModalOpen(true);
                        }}
                      />
                      <IconButton icon={Trash2} label={`Delete record from ${record.recordDate}`} className="hover:text-danger" onClick={() => setDeleting(record)} />
                    </Td>
                  </tr>
                ))}
              </Table>
              <Pagination page={table.data.page} totalPages={table.data.totalPages} total={table.data.total} onChange={setPage} />
            </>
          ) : null}
        </Card>
      </div>

      <ProgressModal open={modalOpen} record={editing} onClose={() => setModalOpen(false)} onSaved={reloadAll} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete progress record?"
        message={`The record from ${formatDate(deleting?.recordDate)} will be permanently removed.`}
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
