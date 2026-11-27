import { Activity, ArrowRight, BarChart3, ClipboardList, Dumbbell, ShieldCheck, Users, Scale, LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { homePath, useAuth } from '../../context/AuthContext';

const features = [
  { icon: Activity, title: 'Workout logging', text: 'Record exercises, sets, repetitions and duration in seconds and keep a complete training history.' },
  { icon: Scale, title: 'Progress tracking', text: 'Log body weight and notes over time and see the trend at a glance.' },
  { icon: ClipboardList, title: 'Trainer workout plans', text: 'Trainers build plans with target sets and reps for each member they coach.' },
  { icon: Users, title: 'Member monitoring', text: 'Trainers follow the workouts and progress of their assigned members only.' },
  { icon: BarChart3, title: 'Live dashboards', text: 'Every role gets a dashboard computed from real activity data.' },
  { icon: ShieldCheck, title: 'Secure by design', text: 'JWT sessions, hashed passwords and role-based access on every request.' },
];

const roles = [
  { name: 'Members', icon: Dumbbell, points: ['Log workouts and progress', 'Follow assigned plans', 'Browse the exercise catalog'] },
  { name: 'Trainers', icon: Users, points: ['Create plans for members', 'Assign exercises and targets', 'Monitor member activity'] },
  { name: 'Administrators', icon: ShieldCheck, points: ['Manage user accounts', 'Maintain the exercise catalog', 'Assign trainers to members'] },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-base">
      <header className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to={homePath(user.role)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-semibold text-on-lime hover:bg-lime-strong">
              Open dashboard <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-muted hover:text-ink">
                Log in
              </Link>
              <Link to="/register" className="inline-flex h-10 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-on-lime hover:bg-lime-strong">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <LineChart className="size-3.5 text-lime" /> Fitness Activity Monitoring and Management System
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] text-ink sm:text-6xl">
              Train with a plan.
              <br />
              <span className="text-lime">Track every rep.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[1rem] leading-relaxed text-muted sm:text-lg">
              FitSync brings members, trainers and administrators onto one platform — so workouts, plans and progress live in one place
              instead of notebooks and scattered apps.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-6 text-sm font-semibold text-on-lime hover:bg-lime-strong">
                Create a member account <ArrowRight className="size-4" />
              </Link>
              <Link to="/login" className="inline-flex h-12 items-center rounded-xl border border-line bg-surface px-6 text-sm font-medium text-ink hover:border-line-strong">
                Log in
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-px px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-lime/10 text-lime">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-[1rem] font-semibold text-ink">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-ink sm:text-3xl">One system, three roles</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">Each role sees only the tools and data it is allowed to use.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {roles.map(({ name, icon: Icon, points }) => (
              <div key={name} className="card p-6">
                <Icon className="size-6 text-lime" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-ink">{name}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-lime" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:justify-between sm:px-6">
          <span>FitSync — ITEC 116 Systems Integration and Architecture 2</span>
          <span>NestJS · TypeORM · MySQL · React</span>
        </div>
      </footer>
    </div>
  );
}
