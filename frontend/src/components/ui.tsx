import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, Loader2, RefreshCw, X, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { initials } from '../lib/format';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-lime text-on-lime hover:bg-lime-strong font-semibold',
  secondary: 'border border-line bg-raised text-ink hover:border-line-strong hover:bg-hover',
  ghost: 'text-muted hover:bg-hover hover:text-ink',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-xs gap-1.5' : 'h-10 px-4 text-sm gap-2';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40 ${className}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------- Form fields
interface FieldShell {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${fieldId}-msg` : undefined} className="field" {...rest} />
      {(error || hint) && (
        <p id={`${fieldId}-msg`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-faint'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/**
 * Password input with a show/hide toggle inside its right edge.
 * Hidden by default; each field keeps its own visibility state. The toggle
 * is a real <button type="button"> (keyboard accessible, never submits the
 * form) and only switches the input between type="password" and "text", so
 * autofill, autocomplete hints, validation and submission are unchanged.
 */
export function PasswordField({ label, error, hint, id, className = '', ...rest }: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`;
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="field password-field pr-11"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={fieldId}
          title={toggleLabel}
          disabled={rest.disabled}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-faint transition-colors hover:text-lime focus-visible:text-lime focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime disabled:pointer-events-none disabled:opacity-50"
        >
          <Icon className="size-4.5" aria-hidden />
        </button>
      </div>
      {(error || hint) && (
        <p id={`${fieldId}-msg`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-faint'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({ label, error, hint, id, className = '', children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <select id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${fieldId}-msg` : undefined} className="field" {...rest}>
        {children}
      </select>
      {(error || hint) && (
        <p id={`${fieldId}-msg`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-faint'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({ label, error, hint, id, className = '', ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <textarea id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${fieldId}-msg` : undefined} className="field min-h-24 resize-y" {...rest} />
      {(error || hint) && (
        <p id={`${fieldId}-msg`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-faint'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Inline error banner used inside forms. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Layout pieces
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', padded = true }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, accent = false }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; accent?: boolean }) {
  return (
    <div className="card flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-faint">{label}</p>
        <p className="mt-2 font-display text-[1.75rem] font-semibold leading-none text-ink">{value}</p>
        {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-lime text-on-lime' : 'bg-raised text-lime'}`}>
        <Icon className="size-5" aria-hidden />
      </span>
    </div>
  );
}

const badgeTones = {
  lime: 'bg-lime/10 text-lime border-lime/25',
  neutral: 'bg-raised text-muted border-line',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/10 text-info border-info/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
};
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>{children}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone = role === 'Admin' ? 'warning' : role === 'Trainer' ? 'info' : 'lime';
  return <Badge tone={tone}>{role}</Badge>;
}

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl' };
  const isUrl = src && /^https?:\/\//.test(src);
  if (isUrl) return <img src={src} alt="" className={`${sizes[size]} shrink-0 rounded-full object-cover`} />;
  return (
    <span aria-hidden className={`${sizes[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-lime/15 font-semibold text-lime`}>
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------- States
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin text-lime ${className}`} aria-hidden />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner className="size-6" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-raised text-faint">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Pagination
export function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-muted">
      <span>
        {total} record{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <span className="px-2 tabular-nums">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <IconButton icon={ChevronRight} label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Modal & confirm
export function Modal({ open, title, onClose, children, footer, size = 'md' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Focus the first form control (or the panel) for keyboard users.
    setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl shadow-black/50 sm:rounded-2xl ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-[1rem] font-semibold text-ink">
            {title}
          </h2>
          <IconButton icon={X} label="Close dialog" onClick={onClose} data-close />
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{message}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Table helpers
/** `compact` drops the 640px minimum width for small tables inside half-width cards. */
export function Table({ head, children, compact = false }: { head: ReactNode; children: ReactNode; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${compact ? '' : 'min-w-[640px]'}`}>
        <thead className="border-b border-line text-xs uppercase tracking-wider text-faint">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Th = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={`px-5 py-3 font-medium ${className}`}>
    {children}
  </th>
);
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`px-5 py-3.5 align-middle ${className}`}>{children}</td>
);
