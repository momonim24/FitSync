import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { usersApi } from '../../api/services';
import { Button, FormError, PasswordField, TextField } from '../../components/ui';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import { AuthShell } from './AuthShell';

type Errors = Partial<Record<'fullName' | 'email' | 'password' | 'confirm', string>>;

/** Client-side checks mirror the API's DTO rules (RegisterUserDto); the API validates again. */
function validate(form: { fullName: string; email: string; password: string; confirm: string }): Errors {
  return {
    fullName: v.requiredText(form.fullName, 'Full name'),
    email: v.email(form.email),
    password: v.newPassword(form.password),
    confirm: v.confirmMatches(form.confirm, form.password),
  };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setServerError(null);
      try {
        // Public registration never sends a role: the API always creates a Member.
        const user = await usersApi.register({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password });
        navigate('/login', { replace: true, state: { registeredEmail: user.email } });
      } catch (err) {
        setServerError(getErrorMessage(err, 'Registration failed.'));
      }
    });
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join FitSync as a member and start tracking your workouts."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-lime hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={serverError} />
        <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} maxLength={100} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={100} />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters with a letter and a number."
          maxLength={72}
        />
        <PasswordField label="Confirm password" autoComplete="new-password" maxLength={v.LIMITS.passwordMax} value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" loading={submitting} icon={UserPlus} className="w-full">
          Create account
        </Button>
        <p className="text-center text-xs text-faint">Trainer and administrator accounts are created by an administrator.</p>
      </form>
    </AuthShell>
  );
}
