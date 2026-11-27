import { MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { feedbackApi, goalsApi, plansApi } from '../api/services';
import type { FeedbackType, TrainerFeedback, User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import * as v from '../lib/validation';
import type { FieldErrors } from '../lib/validation';
import { FEEDBACK_TYPES, FeedbackCard } from './fitness';
import { Button, ConfirmDialog, EmptyState, ErrorState, FormError, IconButton, LoadingState, Modal, Pagination, SelectField, TextAreaField } from './ui';

const MAX = v.LIMITS.feedbackMax;

/**
 * Same normalisation as the API (feedback-text.ts): HTML-like tags are removed
 * before the 2–1000 character rule is checked, so "<b></b>" is rejected here too.
 */
function messageError(raw: string): string | undefined {
  const text = raw.replace(/<\/?[a-zA-Z][^<>]*>/g, '').trim();
  if (text.length < v.LIMITS.feedbackMin) return `Write a message of at least ${v.LIMITS.feedbackMin} characters (HTML tags are removed).`;
  if (text.length > MAX) return `Feedback cannot exceed ${MAX} characters.`;
  return undefined;
}

type Draft = { memberId: string; feedbackType: FeedbackType; feedbackMessage: string; related: string };
const emptyDraft = (memberId = ''): Draft => ({ memberId, feedbackType: 'General', feedbackMessage: '', related: '' });

/** "goal:12" / "plan:5" / "" -> API fields. */
const relatedFields = (related: string) => ({
  relatedGoalId: related.startsWith('goal:') ? Number(related.slice(5)) : null,
  relatedPlanId: related.startsWith('plan:') ? Number(related.slice(5)) : null,
});

/** Goal / plan options of one member for the "About" select. */
function useRelatedOptions(memberId: number | null) {
  const { user } = useAuth();
  const { data } = useFetch(async () => {
    if (!memberId) return { goals: [], plans: [] };
    const [goals, plans] = await Promise.all([goalsApi.list({ memberId, limit: 50 }), plansApi.list({ memberId, trainerId: user?.userId, limit: 50 })]);
    return { goals: goals.items, plans: plans.items };
  }, [memberId]);
  return data ?? { goals: [], plans: [] };
}

function RelatedSelect({ memberId, value, onChange }: { memberId: number | null; value: string; onChange: (v: string) => void }) {
  const { goals, plans } = useRelatedOptions(memberId);
  return (
    <SelectField label="About (optional)" value={value} onChange={(e) => onChange(e.target.value)} disabled={!memberId}>
      <option value="">General — not about a specific goal or plan</option>
      {goals.length > 0 && (
        <optgroup label="Goals">
          {goals.map((g) => (
            <option key={g.goalId} value={`goal:${g.goalId}`}>
              {g.goalName} ({g.status})
            </option>
          ))}
        </optgroup>
      )}
      {plans.length > 0 && (
        <optgroup label="Workout plans">
          {plans.map((p) => (
            <option key={p.planId} value={`plan:${p.planId}`}>
              {p.planName}
            </option>
          ))}
        </optgroup>
      )}
    </SelectField>
  );
}

/**
 * Trainer: write feedback for an assigned member. With `fixedMember` the
 * member is preset (member detail page); otherwise a member select is shown.
 */
export function FeedbackComposer({ fixedMember, members, onSent }: { fixedMember?: User | { userId: number; fullName: string }; members?: User[]; onSent: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft(fixedMember ? String(fixedMember.userId) : ''));
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'memberId' | 'feedbackMessage'>>({});
  const { submitting: sending, run } = useSubmitGuard();
  const memberId = draft.memberId ? Number(draft.memberId) : null;

  useEffect(() => setDraft(emptyDraft(fixedMember ? String(fixedMember.userId) : '')), [fixedMember?.userId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = { memberId: memberId ? undefined : 'Choose an assigned member.', feedbackMessage: messageError(draft.feedbackMessage) };
    setErrors(found);
    if (v.hasErrors(found) || !memberId) return;
    void run(async () => {
      setError(null);
      try {
        await feedbackApi.create({ memberId, feedbackType: draft.feedbackType, feedbackMessage: draft.feedbackMessage, ...relatedFields(draft.related) });
        toast.success('Feedback sent.');
        setDraft(emptyDraft(fixedMember ? String(fixedMember.userId) : draft.memberId));
        onSent();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-label="Write feedback">
      <FormError message={error} />
      {!fixedMember && (
        <SelectField label="Member" value={draft.memberId} error={errors.memberId} onChange={(e) => setDraft({ ...draft, memberId: e.target.value, related: '' })}>
          <option value="">Select an assigned member</option>
          {(members ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))}
        </SelectField>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" value={draft.feedbackType} onChange={(e) => setDraft({ ...draft, feedbackType: e.target.value as FeedbackType })}>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <RelatedSelect memberId={memberId} value={draft.related} onChange={(related) => setDraft({ ...draft, related })} />
      </div>
      <div>
        <TextAreaField label="Message" maxLength={MAX} error={errors.feedbackMessage} value={draft.feedbackMessage} onChange={(e) => setDraft({ ...draft, feedbackMessage: e.target.value })} placeholder="Plain text. The member can read it and mark it as read." />
        <p className="mt-1 text-right text-xs tabular-nums text-faint" aria-live="polite">
          {draft.feedbackMessage.length} / {MAX}
        </p>
      </div>
      <Button type="submit" icon={Send} loading={sending}>
        Send feedback
      </Button>
    </form>
  );
}

/** Trainer: feedback history with edit/delete for the trainer's own notes. */
export function FeedbackHistory({ memberId, version, onChanged }: { memberId?: number; version: number; onChanged: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => feedbackApi.list({ memberId, page, limit: 8 }), [memberId, page, version]);
  const [editing, setEditing] = useState<TrainerFeedback | null>(null);
  const [deleting, setDeleting] = useState<TrainerFeedback | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await feedbackApi.remove(deleting.feedbackId);
      toast.success('Feedback deleted.');
      setDeleting(null);
      reload();
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingState label="Loading feedback…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.items.length === 0) return <EmptyState title="No feedback yet" description="Feedback you send appears here with its read status." icon={MessageSquare} />;

  return (
    <>
      <div className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
        {data.items.map((item) => (
          <FeedbackCard
            key={item.feedbackId}
            item={item}
            viewer="trainer"
            actions={
              item.trainerId === user?.userId ? (
                <>
                  <IconButton icon={Pencil} label="Edit feedback" onClick={() => setEditing(item)} />
                  <IconButton icon={Trash2} label="Delete feedback" className="hover:text-danger" onClick={() => setDeleting(item)} />
                </>
              ) : (
                <span className="text-xs text-faint">by {item.trainer?.fullName}</span>
              )
            }
          />
        ))}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
      <EditFeedbackModal item={editing} onClose={() => setEditing(null)} onSaved={() => (reload(), onChanged())} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete feedback?"
        message="The member will no longer see this feedback. This cannot be undone."
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function EditFeedbackModal({ item, onClose, onSaved }: { item: TrainerFeedback | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [messageErr, setMessageErr] = useState<string | undefined>();
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (!item) return;
    setError(null);
    setMessageErr(undefined);
    setDraft({
      memberId: String(item.memberId),
      feedbackType: item.feedbackType,
      feedbackMessage: item.feedbackMessage,
      related: item.relatedGoalId ? `goal:${item.relatedGoalId}` : item.relatedPlanId ? `plan:${item.relatedPlanId}` : '',
    });
  }, [item]);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const found = messageError(draft.feedbackMessage);
    setMessageErr(found);
    if (found) return;
    void run(async () => {
      setError(null);
      try {
        await feedbackApi.update(item.feedbackId, { feedbackType: draft.feedbackType, feedbackMessage: draft.feedbackMessage, ...relatedFields(draft.related) });
        toast.success('Feedback updated. A changed message shows as new to the member.');
        onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`Edit feedback for ${item?.member?.fullName ?? 'member'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-feedback-form" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-feedback-form" onSubmit={save} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Type" value={draft.feedbackType} onChange={(e) => setDraft({ ...draft, feedbackType: e.target.value as FeedbackType })}>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectField>
          <RelatedSelect memberId={item?.memberId ?? null} value={draft.related} onChange={(related) => setDraft({ ...draft, related })} />
        </div>
        <TextAreaField label="Message" maxLength={MAX} error={messageErr} hint={`${draft.feedbackMessage.length} / ${MAX}`} value={draft.feedbackMessage} onChange={(e) => setDraft({ ...draft, feedbackMessage: e.target.value })} />
      </form>
    </Modal>
  );
}
