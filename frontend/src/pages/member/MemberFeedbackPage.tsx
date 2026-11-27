import { CheckCheck, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { feedbackApi } from '../../api/services';
import { FeedbackCard } from '../../components/fitness';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useUnreadFeedback } from '../../context/UnreadFeedbackContext';
import { useFetch } from '../../hooks/useFetch';

/** Member: feedback from trainers, with new/read status (not a chat). */
export default function MemberFeedbackPage() {
  const toast = useToast();
  const unreadBadge = useUnreadFeedback();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => feedbackApi.list({ unread: filter === 'unread' ? true : undefined, page, limit: 10 }), [filter, page]);
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);

  const refresh = () => {
    reload();
    unreadBadge.refresh();
  };

  async function markRead(id: number) {
    setBusyId(id);
    try {
      await feedbackApi.markRead(id);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId('all');
    try {
      // Mark every unread item, page by page (the list is small; no bulk endpoint is needed).
      for (;;) {
        const batch = await feedbackApi.list({ unread: true, limit: 50 });
        if (batch.items.length === 0) break;
        await Promise.all(batch.items.map((f) => feedbackApi.markRead(f.feedbackId)));
      }
      toast.success('All feedback marked as read.');
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const unread = data?.unread ?? 0;

  return (
    <>
      <PageHeader
        title="Trainer Feedback"
        description="Notes from your trainers about your training, goals and plans."
        actions={
          unread > 0 ? (
            <Button variant="secondary" icon={CheckCheck} loading={busyId === 'all'} onClick={markAllRead}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter feedback" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(['all', 'unread'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => (setFilter(key), setPage(1))}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-lime ${filter === key ? 'bg-lime/10 text-lime' : 'text-muted hover:text-ink'}`}
            >
              {key === 'all' ? 'All' : `Unread${unread ? ` (${unread})` : ''}`}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {unread === 0 ? 'You are all caught up.' : `${unread} new message${unread === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading feedback…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            title={filter === 'unread' ? 'No unread feedback' : 'No feedback yet'}
            description={filter === 'unread' ? 'Everything has been read.' : 'When your trainer leaves feedback, it will appear here.'}
            icon={MessageSquare}
          />
        </div>
      ) : data ? (
        <div className="card overflow-hidden">
          <div className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <FeedbackCard
                key={item.feedbackId}
                item={item}
                viewer="member"
                actions={
                  !item.isRead ? (
                    <Button size="sm" variant="secondary" icon={CheckCheck} loading={busyId === item.feedbackId} onClick={() => markRead(item.feedbackId)}>
                      Mark as read
                    </Button>
                  ) : (
                    <span className="text-xs text-faint">Read</span>
                  )
                }
              />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </div>
      ) : null}
    </>
  );
}
