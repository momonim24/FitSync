import { KeyRound, Save, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { authApi, usersApi } from '../../api/services';
import { Avatar, Button, Card, ConfirmDialog, FormError, PageHeader, PasswordField, RoleBadge, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { formatDateTime } from '../../lib/format';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';

/** Profile settings for every role: PATCH /users/{id}, PATCH /auth/password, DELETE /users/{id}. */
export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', email: user?.email ?? '', profileImg: user?.profileImg ?? '' });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<FieldErrors<'fullName' | 'email' | 'profileImg'>>({});
  const { submitting: savingProfile, run: runProfile } = useSubmitGuard();

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors<'current' | 'next' | 'confirm'>>({});
  const { submitting: savingPassword, run: runPassword } = useSubmitGuard();

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  if (!user) return null;

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const found = {
      fullName: v.requiredText(profile.fullName, 'Full name'),
      email: v.email(profile.email),
      profileImg: v.profileImage(profile.profileImg),
    };
    setProfileErrors(found);
    if (v.hasErrors(found)) return;
    void runProfile(async () => {
      setProfileError(null);
      try {
        const updated = await usersApi.update(user!.userId, {
          fullName: profile.fullName.trim(),
          email: profile.email.trim(),
          profileImg: profile.profileImg.trim() || null,
        });
        setUser(updated);
        toast.success('Profile updated.');
      } catch (err) {
        setProfileError(getErrorMessage(err));
      }
    });
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const found = {
      current: passwords.current ? undefined : 'Current password is required.',
      // Same rules as ChangePasswordDto; the API also refuses a new password equal to the current one.
      next: v.newPassword(passwords.next, 'New password') ?? (passwords.next === passwords.current ? 'New password must be different from the current password.' : undefined),
      confirm: v.confirmMatches(passwords.confirm, passwords.next),
    };
    setPasswordErrors(found);
    if (v.hasErrors(found)) return;
    void runPassword(async () => {
      setPasswordError(null);
      try {
        await authApi.changePassword(passwords.current, passwords.next);
        setPasswords({ current: '', next: '', confirm: '' });
        toast.success('Password changed.');
      } catch (err) {
        setPasswordError(getErrorMessage(err));
      }
    });
  }

  async function deactivate() {
    setDeactivating(true);
    try {
      await usersApi.deactivate(user!.userId);
      logout('Your account has been deactivated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeactivating(false);
      setConfirmDeactivate(false);
    }
  }

  return (
    <>
      <PageHeader title="Profile settings" description="Manage your personal details and password." />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={user.fullName} src={user.profileImg} size="lg" />
            <h2 className="mt-4 text-lg font-semibold">{user.fullName}</h2>
            <p className="text-sm text-muted">{user.email}</p>
            <div className="mt-3">
              <RoleBadge role={user.role} />
            </div>
            <dl className="mt-6 w-full space-y-2 border-t border-line pt-4 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-faint">User ID</dt>
                <dd className="tabular-nums">{user.userId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-faint">Member since</dt>
                <dd>{formatDateTime(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-faint">Status</dt>
                <dd className="text-lime">Active</dd>
              </div>
            </dl>
          </div>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card title="Personal details">
            <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div className="sm:col-span-2">
                <FormError message={profileError} />
              </div>
              <TextField label="Full name" autoComplete="name" value={profile.fullName} maxLength={v.LIMITS.name} error={profileErrors.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
              <TextField label="Email" type="email" autoComplete="email" value={profile.email} maxLength={v.LIMITS.email} error={profileErrors.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              <TextField
                label="Profile image URL (optional)"
                className="sm:col-span-2"
                value={profile.profileImg}
                maxLength={255}
                placeholder="https://…"
                hint="Stored in the ProfileImage column. Leave empty to use your initials."
                error={profileErrors.profileImg}
                onChange={(e) => setProfile({ ...profile, profileImg: e.target.value })}
              />
              <div className="sm:col-span-2">
                <Button type="submit" icon={Save} loading={savingProfile}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Change password">
            <form onSubmit={savePassword} className="grid gap-4 sm:grid-cols-3" noValidate>
              <div className="sm:col-span-3">
                <FormError message={passwordError} />
              </div>
              <PasswordField label="Current password" autoComplete="current-password" maxLength={v.LIMITS.passwordMax} error={passwordErrors.current} value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
              <PasswordField label="New password" autoComplete="new-password" maxLength={v.LIMITS.passwordMax} error={passwordErrors.next} hint="At least 8 characters with a letter and a number." value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
              <PasswordField label="Confirm new password" autoComplete="new-password" maxLength={v.LIMITS.passwordMax} error={passwordErrors.confirm} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
              <div className="sm:col-span-3">
                <Button type="submit" variant="secondary" icon={KeyRound} loading={savingPassword}>
                  Update password
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Deactivate account">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Your data is kept, but you will no longer be able to log in. Only an administrator can re-activate the account.</p>
              <Button variant="danger" icon={UserX} onClick={() => setConfirmDeactivate(true)}>
                Deactivate
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate your account?"
        message="You will be logged out immediately and will not be able to log in again until an administrator re-activates your account."
        confirmLabel="Deactivate account"
        loading={deactivating}
        onConfirm={deactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}
