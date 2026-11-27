import { ChevronRight, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { plansApi } from '../../api/services';
import type { WorkoutPlan } from '../../api/types';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  IconButton,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAssignedMembers } from '../../hooks/useAssignedMembers';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';
import { formatDateTime } from '../../lib/format';

/** Trainer: create, rename/reassign (PUT) and delete workout plans. */
export default function TrainerPlansPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const memberFilter = params.get('memberId') ?? '';
  const [page, setPage] = useState(1);
  const { members } = useAssignedMembers();

  const { data, loading, error, reload } = useFetch(() => plansApi.list({ memberId: memberFilter, page, limit: 10 }), [memberFilter, page]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutPlan | null>(null);
  const [deleting, setDeleting] = useState<WorkoutPlan | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await plansApi.remove(deleting.planId);
      toast.success('Workout plan deleted.');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Workout Plans"
        description="Plans you created for your assigned members."
        actions={
          <Button
            icon={Plus}
            disabled={members.length === 0}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New plan
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="border-b border-line p-4">
          <label className="block max-w-xs">
            <span className="label">Member</span>
            <select
              className="field"
              value={memberFilter}
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
        </div>

        {loading && !data ? (
          <LoadingState label="Loading plans…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No workout plans"
            description={members.length === 0 ? 'You need an assigned member before creating a plan.' : 'Create a plan and add exercises with target sets and reps.'}
            icon={ClipboardList}
          />
        ) : data ? (
          <>
            <ul className="divide-y divide-line">
              {data.items.map((plan) => (
                <li key={plan.planId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <Link to={`/trainer/plans/${plan.planId}`} className="group flex min-w-0 flex-1 items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-lime">
                      <ClipboardList className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink group-hover:text-lime">{plan.planName}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                        {plan.member && <Avatar name={plan.member.fullName} size="sm" />}
                        {plan.member?.fullName} · Created {formatDateTime(plan.createdAt)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge tone="lime">{plan.planExercises?.length ?? 0} exercises</Badge>
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${plan.planName}`}
                      onClick={() => {
                        setEditing(plan);
                        setFormOpen(true);
                      }}
                    />
                    <IconButton icon={Trash2} label={`Delete ${plan.planName}`} className="hover:text-danger" onClick={() => setDeleting(plan)} />
                    <Link to={`/trainer/plans/${plan.planId}`} aria-label={`Manage exercises in ${plan.planName}`} className="rounded-lg p-1.5 text-faint hover:bg-hover hover:text-ink">
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>

      <PlanFormModal
        open={formOpen}
        plan={editing}
        members={members}
        defaultMemberId={memberFilter}
        onClose={() => setFormOpen(false)}
        onSaved={() => reload()}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete workout plan?"
        message={
          <>
            <strong className="text-ink">{deleting?.planName}</strong> and all of its exercises will be permanently deleted.
          </>
        }
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function PlanFormModal({
  open,
  plan,
  members,
  defaultMemberId,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: WorkoutPlan | null;
  members: { userId: number; fullName: string }[];
  defaultMemberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [memberId, setMemberId] = useState('');
  const [planName, setPlanName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'memberId' | 'planName'>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    setMemberId(plan ? String(plan.memberId) : defaultMemberId);
    setPlanName(plan?.planName ?? '');
    setError(null);
    setErrors({});
  }, [open, plan, defaultMemberId]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      memberId: v.selected(memberId, 'Choose an assigned member.'),
      planName: v.requiredText(planName, 'Plan name'),
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setError(null);
      try {
        const payload = { memberId: Number(memberId), planName: planName.trim() };
        if (plan) await plansApi.replace(plan.planId, payload);
        else await plansApi.create(payload);
        toast.success(plan ? 'Workout plan updated.' : 'Workout plan created.');
        onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? 'Edit workout plan' : 'New workout plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={saving}>
            {plan ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <SelectField label="Member" value={memberId} error={errors.memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Select a member</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName}
            </option>
          ))}
        </SelectField>
        <TextField label="Plan name" value={planName} maxLength={v.LIMITS.name} error={errors.planName} placeholder="e.g. Beginner Strength Foundations" onChange={(e) => setPlanName(e.target.value)} />
      </form>
    </Modal>
  );
}
