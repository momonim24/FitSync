import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, FormError, PasswordField, TextField } from '../../components/ui';
import { homePath, useAuth } from '../../context/AuthContext';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import * as v from '../../lib/validation';
import type { FieldErrors } from '../../lib/validation';
import { AuthShell } from './AuthShell';

export default function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as { registeredEmail?: string } | null)?.registeredEmail;
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState(registered ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const { submitting, run } = useSubmitGuard();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors<'email' | 'password'> = {
      email: v.email(email),
      password: !password ? 'Password is required.' : password.length > v.LIMITS.passwordMax ? `Password cannot exceed ${v.LIMITS.passwordMax} characters.` : undefined,
    };
    setErrors(found);
    if (v.hasErrors(found)) return;
    void run(async () => {
      setError(null);
      clearSessionMessage();
      try {
        const user = await login(email.trim(), password);
        const target = from && from.startsWith(homePath(user.role)) ? from : homePath(user.role);
        navigate(target, { replace: true });
      } catch (err) {
        setError(getErrorMessage(err, 'Login failed.'));
      }
    });
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue to your FitSync dashboard."
      footer={
        <>
          New to FitSync?{' '}
          <Link to="/register" className="font-medium text-lime hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {registered && !error && (
          <div role="status" className="rounded-xl border border-lime/30 bg-lime/10 px-3.5 py-2.5 text-sm text-lime">
            Account created. You can now log in.
          </div>
        )}
        {sessionMessage && !error && (
          <div role="status" className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
            {sessionMessage}
          </div>
        )}
        <FormError message={error} />
        <TextField label="Email" type="email" autoComplete="email" maxLength={v.LIMITS.email} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          maxLength={v.LIMITS.passwordMax}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <Button type="submit" loading={submitting} icon={LogIn} className="w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
