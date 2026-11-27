import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from './components/resilience';
import { AppLayout } from './components/AppLayout';
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AssignmentsPage from './pages/admin/AssignmentsPage';
import ExercisesAdminPage from './pages/admin/ExercisesAdminPage';
import UsersPage from './pages/admin/UsersPage';
import AdminReportPage from './pages/admin/AdminReportPage';
import MemberReportPage from './pages/member/MemberReportPage';
import ExerciseLibraryPage from './pages/shared/ExerciseLibraryPage';
import TrainerReportPage from './pages/trainer/TrainerReportPage';
import ExerciseCatalogPage from './pages/member/ExerciseCatalogPage';
import MemberDashboard from './pages/member/MemberDashboard';
import MemberPlansPage from './pages/member/MemberPlansPage';
import ProgressPage from './pages/member/ProgressPage';
import WorkoutLogsPage from './pages/member/WorkoutLogsPage';
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ProfilePage from './pages/shared/ProfilePage';
import MemberProgressPage from './pages/trainer/MemberProgressPage';
import MemberWorkoutsPage from './pages/trainer/MemberWorkoutsPage';
import PlanDetailPage from './pages/trainer/PlanDetailPage';
import TrainerDashboard from './pages/trainer/TrainerDashboard';
import TrainerMembersPage from './pages/trainer/TrainerMembersPage';
import TrainerPlansPage from './pages/trainer/TrainerPlansPage';
import MemberGoalsPage from './pages/member/MemberGoalsPage';
import MemberFeedbackPage from './pages/member/MemberFeedbackPage';
import TrainerGoalsPage from './pages/trainer/TrainerGoalsPage';
import TrainerFeedbackPage from './pages/trainer/TrainerFeedbackPage';
import TrainerMemberDetailPage from './pages/trainer/TrainerMemberDetailPage';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base px-4 text-center">
      <p className="font-display text-6xl font-semibold text-lime">404</p>
      <p className="text-muted">This page does not exist.</p>
      <Link to="/" className="text-sm font-medium text-lime hover:underline">
        Back to FitSync
      </Link>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  // Outer safety net for pages outside the signed-in layout (QA fix H2);
  // signed-in pages have their own boundary inside AppLayout.
  return (
    <PageErrorBoundary resetKey={location.pathname}>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      {/* Member */}
      <Route path="/member" element={<ProtectedRoute roles={['Member']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<MemberDashboard />} />
        <Route path="exercises" element={<ExerciseCatalogPage />} />
        <Route path="workouts" element={<WorkoutLogsPage />} />
        <Route path="plans" element={<MemberPlansPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="goals" element={<MemberGoalsPage />} />
        <Route path="feedback" element={<MemberFeedbackPage />} />
        <Route path="library" element={<ExerciseLibraryPage />} />
        <Route path="reports" element={<MemberReportPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Trainer */}
      <Route path="/trainer" element={<ProtectedRoute roles={['Trainer']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<TrainerDashboard />} />
        <Route path="members" element={<TrainerMembersPage />} />
        <Route path="members/:memberId" element={<TrainerMemberDetailPage />} />
        <Route path="goals" element={<TrainerGoalsPage />} />
        <Route path="feedback" element={<TrainerFeedbackPage />} />
        <Route path="plans" element={<TrainerPlansPage />} />
        <Route path="plans/:planId" element={<PlanDetailPage />} />
        <Route path="workouts" element={<MemberWorkoutsPage />} />
        <Route path="progress" element={<MemberProgressPage />} />
        <Route path="library" element={<ExerciseLibraryPage />} />
        <Route path="reports" element={<TrainerReportPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['Admin']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="exercises" element={<ExercisesAdminPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="library" element={<ExerciseLibraryPage />} />
        <Route path="reports" element={<AdminReportPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </PageErrorBoundary>
  );
}
