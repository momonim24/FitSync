export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#c6f432" />
      <path d="M7 17h4l2.5-6 5 12 2.5-6H25" fill="none" stroke="#121405" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && <span className="font-display text-lg font-semibold tracking-tight text-ink">FitSync</span>}
    </span>
  );
}
