import { ArrowRight, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { assignmentsApi, usersApi } from '../../api/services';
import type { TrainerAssignment } from '../../api/types';
import {
  Avatar,
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
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';
import { formatDateTime } from '../../lib/format';

/** Admin: manage trainer-member assignments (POST / PUT / DELETE /trainer-assignments). */
export default function AssignmentsPage() {
  const toast = useToast();
  const [trainerFilter, setTrainerFilter] = useState('');
  const [page, setPage] = useState(1);

  const trainers = useFetch(() => usersApi.list({ role: 'Trainer', isActive: 'true', limit: 100 }).then((p) => p.items), []);
  const members = useFetch(() => usersApi.list({ role: 'Member', isActive: 'true', limit: 100 }).then((p) => p.items), []);
  const { data, loading, error, reload } = useFetch(() => assignmentsApi.list({ trainerId: trainerFilter, page, limit: 12 }), [trainerFilter, page]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainerAssignment | null>(null);
  const [removing, setRemoving] = useState<TrainerAssignment | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await assignmentsApi.remove(removing.assignmentId);
      toast.success('Assignment removed.');
      setRemoving(null);
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
        title="Trainer Assignments"
        description="Decide which trainer monitors which member. Trainers can only see their assigned members."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Assign trainer
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="border-b border-line p-4">
          <label className="block max-w-xs">
            <span className="label">Trainer</span>
            <select className="field" value={trainerFilter} onChange={(e) => (setTrainerFilter(e.target.value), setPage(1))}>
              <option value="">All trainers</option>
              {(trainers.data ?? []).map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading assignments…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No assignments yet" description="Assign a trainer to a member to get started." icon={Link2} />
        ) : data ? (
          <>
            <Table
              head={
                <>
                  <Th>Trainer</Th>
                  <Th className="w-8" />
                  <Th>Member</Th>
                  <Th>Assigned</Th>
                  <Th className="w-28 text-right">Actions</Th>
                </>
              }
            >
              {data.items.map((a) => (
                <tr key={a.assignmentId} className="hover:bg-raised/50">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={a.trainer?.fullName ?? '?'} size="sm" />
                      <span className="font-medium">{a.trainer?.fullName}</span>
                    </span>
                  </Td>
                  <Td>
                    <ArrowRight className="size-4 text-faint" aria-label="coaches" />
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={a.member?.fullName ?? '?'} size="sm" />
                      <span>
                        <span className="block font-medium">{a.member?.fullName}</span>
                        <span className="block text-xs text-faint">{a.member?.email}</span>
                      </span>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(a.assignedAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <IconButton
                      icon={Pencil}
                      label="Reassign"
                      onClick={() => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                    />
                    <IconButton icon={Trash2} label="Remove assignment" className="hover:text-danger" onClick={() => setRemoving(a)} />
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>

      <AssignmentModal
        open={formOpen}
        assignment={editing}
        trainers={trainers.data ?? []}
        members={members.data ?? []}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove assignment?"
        message={`${removing?.trainer?.fullName} will immediately lose access to ${removing?.member?.fullName}'s workouts and progress. Existing plans are kept.`}
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

function AssignmentModal({
  open,
  assignment,
  trainers,
  members,
  onClose,
  onSaved,
}: {
  open: boolean;
  assignment: TrainerAssignment | null;
  trainers: { userId: number; fullName: string }[];
  members: { userId: number; fullName: string; email: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [trainerId, setTrainerId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'trainerId' | 'memberId'>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    setTrainerId(assignment ? String(assignment.trainerId) : '');
    setMemberId(assignment ? String(assignment.memberId) : '');
    setError(null);
    setErrors({});
  }, [open, assignment]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      trainerId: v.selected(trainerId, 'Choose a trainer.'),
      memberId: v.selected(memberId, 'Choose a member.'),
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setError(null);
      try {
        // Admin-only (the API checks the role, the roles of both users and duplicates -> 409).
        if (assignment) await assignmentsApi.replace(assignment.assignmentId, Number(trainerId), Number(memberId));
        else await assignmentsApi.create(Number(trainerId), Number(memberId));
        toast.success(assignment ? 'Assignment updated.' : 'Trainer assigned.');
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
      title={assignment ? 'Reassign' : 'Assign trainer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="assignment-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <SelectField label="Trainer" value={trainerId} error={errors.trainerId} onChange={(e) => setTrainerId(e.target.value)}>
          <option value="">Select a trainer</option>
          {trainers.map((t) => (
            <option key={t.userId} value={t.userId}>
              {t.fullName}
            </option>
          ))}
        </SelectField>
        <SelectField label="Member" value={memberId} error={errors.memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Select a member</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName} — {m.email}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}
