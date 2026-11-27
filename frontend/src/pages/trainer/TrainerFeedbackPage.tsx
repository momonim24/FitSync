import { useState } from 'react';
import { FeedbackComposer, FeedbackHistory } from '../../components/trainer-feedback';
import { Card, PageHeader } from '../../components/ui';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';

/** Trainer: write feedback to assigned members and manage feedback history. */
export default function TrainerFeedbackPage() {
  const { members, loading } = useAssignedMembers();
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  return (
    <>
      <PageHeader title="Feedback" description="Short notes for your assigned members about their training, goals and plans." />
      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Card title="Write feedback" className="xl:col-span-2">
          {loading ? <p className="text-sm text-muted">Loading members…</p> : <FeedbackComposer members={members} onSent={bump} />}
        </Card>
        <Card
          title="Feedback history"
          padded={false}
          className="xl:col-span-3"
          action={
            <select aria-label="Filter feedback by member" className="field h-9 w-44 py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All members</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName}
                </option>
              ))}
            </select>
          }
        >
          <FeedbackHistory memberId={filter ? Number(filter) : undefined} version={version} onChanged={bump} />
        </Card>
      </div>
    </>
  );
}
