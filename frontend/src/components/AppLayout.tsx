import { PageErrorBoundary } from './resilience';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Dumbbell,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  UserCircle,
  Users,
  UserCog,
  Link2,
  Globe,
  FileBarChart,
  MessageSquare,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { UnreadFeedbackProvider, useUnreadFeedback } from '../context/UnreadFeedbackContext';
import { Logo } from './Logo';
import { Avatar, RoleBadge } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Shows the member's unread trainer-feedback count. */
  badge?: 'unreadFeedback';
}

/** Role-specific navigation: each role only sees the pages it may use. */
const NAV: Record<Role, NavItem[]> = {
  Member: [
    { to: '/member', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/member/exercises', label: 'Exercise Catalog', icon: Dumbbell },
    { to: '/member/library', label: 'Exercise Library', icon: Globe },
    { to: '/member/workouts', label: 'Workout Logs', icon: Activity },
    { to: '/member/plans', label: 'My Plans', icon: ClipboardList },
    { to: '/member/goals', label: 'Fitness Goals', icon: Target },
    { to: '/member/feedback', label: 'Trainer Feedback', icon: MessageSquare, badge: 'unreadFeedback' },
    { to: '/member/progress', label: 'Progress', icon: Scale },
    { to: '/member/reports', label: 'Reports', icon: FileBarChart },
    { to: '/member/profile', label: 'Profile', icon: UserCircle },
  ],
  Trainer: [
    { to: '/trainer', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/trainer/members', label: 'My Members', icon: Users },
    { to: '/trainer/plans', label: 'Workout Plans', icon: ClipboardList },
    { to: '/trainer/workouts', label: 'Member Workouts', icon: History },
    { to: '/trainer/progress', label: 'Member Progress', icon: BarChart3 },
    { to: '/trainer/goals', label: 'Member Goals', icon: Target },
    { to: '/trainer/feedback', label: 'Feedback', icon: MessageSquare },
    { to: '/trainer/reports', label: 'Reports', icon: FileBarChart },
    { to: '/trainer/library', label: 'Exercise Library', icon: Globe },
    { to: '/trainer/profile', label: 'Profile', icon: UserCircle },
  ],
  Admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: UserCog },
    { to: '/admin/exercises', label: 'Exercises', icon: Dumbbell },
    { to: '/admin/library', label: 'Exercise Library', icon: Globe },
    { to: '/admin/assignments', label: 'Trainer Assignments', icon: Link2 },
    { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { to: '/admin/profile', label: 'Profile', icon: UserCircle },
  ],
};

const COLLAPSE_KEY = 'fitsync.sidebarCollapsed';

/** Authenticated layout: sidebar navigation + page outlet. */
export function AppLayout() {
  return (
    <UnreadFeedbackProvider>
      <AppShell />
    </UnreadFeedbackProvider>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const unread = useUnreadFeedback();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        /* storage unavailable — ignore */
      }
      return !value;
    });
  };

  if (!user) return null;
  const items = NAV[user.role];

  const navList = (isCollapsed: boolean) => (
    <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-4">
      {items.map(({ to, label, icon: Icon, end, badge }) => {
        const count = badge === 'unreadFeedback' ? unread.count : 0;
        const fullLabel = count ? `${label}, ${count} unread` : label;
        return (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={isCollapsed ? fullLabel : undefined}
          aria-label={count ? fullLabel : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-lime/10 text-lime' : 'text-muted hover:bg-hover hover:text-ink'
            } ${isCollapsed ? 'justify-center' : ''}`
          }
        >
          <span className="relative">
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {count > 0 && isCollapsed && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-lime ring-2 ring-surface" aria-hidden />}
          </span>
          {isCollapsed ? <span className="sr-only">{fullLabel}</span> : <span className="flex-1">{label}</span>}
          {count > 0 && !isCollapsed && (
            <span className="min-w-5 rounded-full bg-lime px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-on-lime" aria-hidden>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </NavLink>
        );
      })}
    </nav>
  );

  const userBlock = (isCollapsed: boolean) => (
    <div className="border-t border-line p-3">
      <div className={`flex items-center gap-3 rounded-xl p-2 ${isCollapsed ? 'justify-center' : ''}`}>
        <Avatar name={user.fullName} src={user.profileImg} size="sm" />
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-faint">{user.email}</p>
          </div>
        )}
      </div>
      <button
        onClick={() => logout()}
        title={isCollapsed ? 'Log out' : undefined}
        className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink ${isCollapsed ? 'justify-center' : ''}`}
      >
        <LogOut className="size-[18px]" aria-hidden />
        {isCollapsed ? <span className="sr-only">Log out</span> : 'Log out'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-base">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? 'w-[76px]' : 'w-64'}`}
      >
        <div className={`flex h-16 items-center border-b border-line px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Logo collapsed={collapsed} />
          {!collapsed && (
            <button onClick={toggleCollapsed} className="rounded-lg p-1.5 text-faint hover:bg-hover hover:text-ink" aria-label="Collapse sidebar">
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggleCollapsed} className="mx-auto mt-3 rounded-lg p-1.5 text-faint hover:bg-hover hover:text-ink" aria-label="Expand sidebar">
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        {navList(collapsed)}
        {userBlock(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-hover" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {navList(false)}
            {userBlock(false)}
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-base/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:bg-hover lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="lg:hidden">
              <Logo />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge role={user.role} />
            <span className="hidden text-sm text-muted sm:inline">{user.fullName}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <PageErrorBoundary resetKey={location.pathname} homePath={items[0]?.to}>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
