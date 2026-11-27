import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';

/** Shared two-column frame for the login and registration pages. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-base lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link to="/" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-ink">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-6 text-center text-sm text-muted">{footer}</p>
          </div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:flex lg:items-end">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#c6f432 1px, transparent 1px)', backgroundSize: '22px 22px' }} aria-hidden />
        <div className="relative p-12">
          <p className="font-display text-4xl font-semibold leading-tight text-ink">
            Consistency beats intensity.
            <br />
            <span className="text-lime">FitSync keeps the record.</span>
          </p>
          <p className="mt-4 max-w-md text-sm text-muted">Workouts, plans and progress for members, trainers and administrators — in one secure place.</p>
        </div>
      </aside>
    </div>
  );
}
