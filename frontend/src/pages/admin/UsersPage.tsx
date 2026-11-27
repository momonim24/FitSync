import { Pencil, Search, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { usersApi } from '../../api/services';
import type { Role, User } from '../../api/types';
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
  PasswordField,
  RoleBadge,
  SelectField,
  Table,
  Td,
  TextField,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { formatDateTime } from '../../lib/format';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';

const ROLES: Role[] = ['Member', 'Trainer', 'Admin'];

/** Admin: list, create, edit, change role, deactivate and re-activate accounts. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useFetch(() => usersApi.list({ search: debounced, role, isActive: status, page, limit: 12 }), [debounced, role, status, page]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmToggle() {
    if (!toggling) return;
    setBusy(true);
    try {
      if (toggling.isActive) await usersApi.deactivate(toggling.userId);
      else await usersApi.activate(toggling.userId);
      toast.success(toggling.isActive ? `${toggling.fullName} was deactivated.` : `${toggling.fullName} was re-activated.`);
      setToggling(null);
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
        title="User Management"
        description="Create accounts, change roles and control account access."
        actions={
          <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
            New account
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input className="field pl-10" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <select className="field" value={role} onChange={(e) => (setRole(e.target.value), setPage(1))}>
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select className="field" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
              <option value="">Any status</option>
              <option value="true">Active</option>
              <option value="false">Deactivated</option>
            </select>
          </label>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading users…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No users match" description="Adjust the search or filters." icon={Users} />
        ) : data ? (
          <>
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                head={
                  <>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th className="w-28 text-right">Actions</Th>
                  </>
                }
              >
                {data.items.map((u) => (
                  <tr key={u.userId} className="hover:bg-raised/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} src={u.profileImg} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {u.fullName} {u.userId === me?.userId && <span className="text-xs text-faint">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-faint">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <RoleBadge role={u.role} />
                    </Td>
                    <Td>{u.isActive ? <Badge tone="lime">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(u.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <IconButton icon={Pencil} label={`Edit ${u.fullName}`} onClick={() => setEditing(u)} />
                      {u.isActive ? (
                        <IconButton icon={UserX} label={`Deactivate ${u.fullName}`} className="hover:text-danger" onClick={() => setToggling(u)} disabled={u.userId === me?.userId} />
                      ) : (
                        <IconButton icon={UserCheck} label={`Re-activate ${u.fullName}`} className="hover:text-lime" onClick={() => setToggling(u)} />
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        ) : null}
      </div>

      <CreateAccountModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={reload} />
      <EditUserModal user={editing} isSelf={editing?.userId === me?.userId} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.isActive ? 'Deactivate account?' : 'Re-activate account?'}
        message={
          toggling?.isActive
            ? `${toggling?.fullName} will be logged out and unable to log in. Their records are kept.`
            : `${toggling?.fullName} will be able to log in again.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Re-activate'}
        danger={toggling?.isActive}
        loading={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}

function CreateAccountModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const empty = { fullName: '', email: '', password: '', role: 'Trainer' as Role };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'fullName' | 'email' | 'role' | 'password'>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError(null);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      fullName: v.requiredText(form.fullName, 'Full name'),
      email: v.email(form.email),
      role: ROLES.includes(form.role) ? undefined : 'Choose a role.',
      password: v.newPassword(form.password, 'Temporary password'),
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setError(null);
      try {
        // Only administrators reach this form; the API also requires the Admin role (POST /users/accounts).
        const created = await usersApi.createAccount({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
        toast.success(`${created.role} account created for ${created.fullName}.`);
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
      title="New account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-account-form" loading={saving}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-account-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <TextField label="Full name" value={form.fullName} maxLength={v.LIMITS.name} error={errors.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <TextField label="Email" type="email" value={form.email} maxLength={v.LIMITS.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <SelectField label="Role" value={form.role} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
        <PasswordField
          label="Temporary password"
          autoComplete="new-password"
          value={form.password}
          maxLength={v.LIMITS.passwordMax}
          error={errors.password}
          hint="At least 8 characters with a letter and a number. Share it securely; the user can change it in Profile."
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </form>
    </Modal>
  );
}

function EditUserModal({ user, isSelf, onClose, onSaved }: { user: User | null; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', email: '', role: 'Member' as Role });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'fullName' | 'email' | 'role'>>({});
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (user) {
      setForm({ fullName: user.fullName, email: user.email, role: user.role });
      setError(null);
      setErrors({});
    }
  }, [user]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const found = {
      fullName: v.requiredText(form.fullName, 'Full name'),
      email: v.email(form.email),
      role: isSelf && form.role !== user.role ? 'You cannot change your own role.' : undefined,
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setError(null);
      try {
        await usersApi.update(user.userId, { fullName: form.fullName.trim(), email: form.email.trim() });
        // Role changes are admin-only (PATCH /users/{id}/role requires the Admin role).
        if (form.role !== user.role) await usersApi.changeRole(user.userId, form.role);
        toast.success('User updated.');
        onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err));
        onSaved();
      }
    });
  }

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Edit ${user?.fullName ?? 'user'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <TextField label="Full name" value={form.fullName} maxLength={v.LIMITS.name} error={errors.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <TextField label="Email" type="email" value={form.email} maxLength={v.LIMITS.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <SelectField label="Role" value={form.role} disabled={isSelf} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
        {isSelf && <p className="-mt-2 text-xs text-faint">You cannot change your own role.</p>}
      </form>
    </Modal>
  );
}
