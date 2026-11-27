import type { AxiosResponse } from 'axios';
import { api } from './client';
import type {
  Adherence,
  FeedbackType,
  FitnessGoal,
  GoalType,
  PlanCompletion,
  TrainerFeedback,
  WorkoutCompletion,
  AdminDashboard,
  AdminReport,
  ExternalExercise,
  MemberReport,
  Named,
  TrainerReport,
  Exercise,
  LoginResponse,
  MemberDashboard,
  Page,
  PlanExercise,
  ProgressRecord,
  Role,
  TrainerAssignment,
  TrainerDashboard,
  User,
  WorkoutLog,
  WorkoutPlan,
} from './types';

type Query = Record<string, string | number | boolean | undefined | null>;

/** Drops empty filter values so they are not sent as ?search= */
function clean(params: Query = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/** List endpoints return an array body plus X-Total-Count / X-Total-Pages headers. */
function toPage<T>(res: AxiosResponse<T[]>): Page<T> {
  return {
    items: res.data,
    total: Number(res.headers['x-total-count'] ?? res.data.length),
    page: Number(res.headers['x-page'] ?? 1),
    totalPages: Number(res.headers['x-total-pages'] ?? 1),
  };
}

const list = async <T>(url: string, params?: Query) => toPage(await api.get<T[]>(url, { params: clean(params) }));

// ---------------------------------------------------------------- Auth
export const authApi = {
  login: (email: string, password: string) => api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ message: string }>('/auth/password', { currentPassword, newPassword }).then((r) => r.data),
};

// ---------------------------------------------------------------- Users
export const usersApi = {
  register: (data: { fullName: string; email: string; password: string }) => api.post<User>('/users', data).then((r) => r.data),
  createAccount: (data: { fullName: string; email: string; password: string; role: Role }) =>
    api.post<User>('/users/accounts', data).then((r) => r.data),
  list: (params?: Query) => list<User>('/users', params),
  get: (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data),
  update: (id: number, data: Partial<Pick<User, 'fullName' | 'email' | 'profileImg'>>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),
  deactivate: (id: number) => api.delete(`/users/${id}`),
  activate: (id: number) => api.patch<User>(`/users/${id}/activate`).then((r) => r.data),
  changeRole: (id: number, role: Role) => api.patch<User>(`/users/${id}/role`, { role }).then((r) => r.data),
};

// ---------------------------------------------------------------- Exercises
export type ExerciseInput = Pick<Exercise, 'exerciseName' | 'category'> & { description: string | null };
export const exercisesApi = {
  list: (params?: Query) => list<Exercise>('/exercises', params),
  categories: () => api.get<string[]>('/exercises/categories').then((r) => r.data),
  get: (id: number) => api.get<Exercise>(`/exercises/${id}`).then((r) => r.data),
  create: (data: ExerciseInput) => api.post<Exercise>('/exercises', data).then((r) => r.data),
  replace: (id: number, data: ExerciseInput) => api.put<Exercise>(`/exercises/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/exercises/${id}`),
};

// ---------------------------------------------------------------- Trainer assignments
export const assignmentsApi = {
  list: (params?: Query) => list<TrainerAssignment>('/trainer-assignments', params),
  create: (trainerId: number, memberId: number) =>
    api.post<TrainerAssignment>('/trainer-assignments', { trainerId, memberId }).then((r) => r.data),
  replace: (id: number, trainerId: number, memberId: number) =>
    api.put<TrainerAssignment>(`/trainer-assignments/${id}`, { trainerId, memberId }).then((r) => r.data),
  remove: (id: number) => api.delete(`/trainer-assignments/${id}`),
};

// ---------------------------------------------------------------- Workout plans
export const plansApi = {
  list: (params?: Query) => list<WorkoutPlan>('/workout-plans', params),
  get: (id: number) => api.get<WorkoutPlan>(`/workout-plans/${id}`).then((r) => r.data),
  create: (data: { memberId: number; planName: string }) => api.post<WorkoutPlan>('/workout-plans', data).then((r) => r.data),
  replace: (id: number, data: { memberId: number; planName: string }) =>
    api.put<WorkoutPlan>(`/workout-plans/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/workout-plans/${id}`),
};

export const planExercisesApi = {
  create: (data: { planId: number; exerciseId: number; targetSets: number; targetReps?: number; targetDurationMinutes?: number }) =>
    api.post<PlanExercise>('/plan-exercises', data).then((r) => r.data),
  update: (id: number, data: { targetSets?: number; targetReps?: number; targetDurationMinutes?: number | null }) =>
    api.patch<PlanExercise>(`/plan-exercises/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/plan-exercises/${id}`),
};

// ---------------------------------------------------------------- Workout logs
export type WorkoutLogInput = Pick<WorkoutLog, 'exerciseId' | 'workoutDate' | 'sets' | 'repetitions' | 'durationMinutes'>;
export const logsApi = {
  list: (params?: Query) => list<WorkoutLog>('/workout-logs', params),
  create: (data: WorkoutLogInput) => api.post<WorkoutLog>('/workout-logs', data).then((r) => r.data),
  update: (id: number, data: Partial<WorkoutLogInput>) => api.patch<WorkoutLog>(`/workout-logs/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/workout-logs/${id}`),
};

// ---------------------------------------------------------------- Progress records
export type ProgressInput = { recordDate: string; weightKg: number | null; notes: string | null };
export const progressApi = {
  list: (params?: Query) => list<ProgressRecord>('/progress-records', params),
  create: (data: ProgressInput) => api.post<ProgressRecord>('/progress-records', data).then((r) => r.data),
  update: (id: number, data: Partial<ProgressInput>) => api.patch<ProgressRecord>(`/progress-records/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/progress-records/${id}`),
};

// ---------------------------------------------------------------- Dashboards
export const dashboardApi = {
  member: () => api.get<MemberDashboard>('/dashboard/member').then((r) => r.data),
  trainer: () => api.get<TrainerDashboard>('/dashboard/trainer').then((r) => r.data),
  admin: () => api.get<AdminDashboard>('/dashboard/admin').then((r) => r.data),
};

// ---------------------------------------------------------------- External Fitness API (wger, via the FitSync backend)
export type ExternalPage = Page<ExternalExercise> & { cache: string | null };
export const externalApi = {
  list: async (params?: Query): Promise<ExternalPage> => {
    const res = await api.get<ExternalExercise[]>('/external-fitness/exercises', { params: clean(params) });
    return { ...toPage(res), cache: (res.headers['x-cache'] as string) ?? null };
  },
  get: (id: number) => api.get<ExternalExercise>(`/external-fitness/exercises/${id}`).then((r) => r.data),
  categories: () => api.get<Named[]>('/external-fitness/categories').then((r) => r.data),
  equipment: () => api.get<Named[]>('/external-fitness/equipment').then((r) => r.data),
  importExercise: (id: number) => api.post<Exercise>(`/external-fitness/exercises/${id}/import`).then((r) => r.data),
};

// ---------------------------------------------------------------- Reports
export type ReportParams = { period: 'week' | 'month' | 'custom'; from?: string; to?: string };
const reportParams = (p: ReportParams) => clean(p.period === 'custom' ? p : { period: p.period });

export const reportsApi = {
  member: (p: ReportParams) => api.get<MemberReport>('/reports/member', { params: reportParams(p) }).then((r) => r.data),
  trainer: (p: ReportParams) => api.get<TrainerReport>('/reports/trainer', { params: reportParams(p) }).then((r) => r.data),
  trainerMember: (memberId: number, p: ReportParams) =>
    api.get<MemberReport>(`/reports/trainer/members/${memberId}`, { params: reportParams(p) }).then((r) => r.data),
  admin: (p: ReportParams) => api.get<AdminReport>('/reports/admin', { params: reportParams(p) }).then((r) => r.data),

  /** Downloads the CSV version of a report (the request needs the JWT, so a plain link would not work). */
  downloadCsv: async (path: string, p: ReportParams): Promise<void> => {
    const res = await api.get<Blob>(path, { params: { ...reportParams(p), format: 'csv' }, responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'fitsync-report.csv';
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ================================================================ Version 2.0 — fitness management
export type CompletionPeriod = { period: 'week' | 'month' | 'custom'; from?: string; to?: string };
const periodParams = (p?: CompletionPeriod) => (p ? clean(p.period === 'custom' ? p : { period: p.period }) : undefined);

export const completionsApi = {
  /** Prescribed vs actual for one plan in a period (default: last 7 days). */
  plan: (planId: number, p?: CompletionPeriod) => api.get<PlanCompletion>(`/workout-plans/${planId}/completion`, { params: periodParams(p) }).then((r) => r.data),
  history: (params?: Query) => list<WorkoutCompletion>('/workout-completions', params),
  adherence: (params?: { memberId?: number } & Partial<CompletionPeriod>) =>
    api.get<Adherence>('/workout-completions/adherence', { params: clean(params as Query) }).then((r) => r.data),
  /** Count an existing workout toward a plan exercise. */
  link: (logId: number, planExerciseId: number) => api.post<WorkoutCompletion>('/workout-completions', { logId, planExerciseId }).then((r) => r.data),
  unlink: (completionId: number) => api.delete(`/workout-completions/${completionId}`),
  /** Record a workout from a plan (POST /workout-logs with planExerciseId). */
  logFromPlan: (data: WorkoutLogInput & { planExerciseId: number }) => api.post<WorkoutLog>('/workout-logs', data).then((r) => r.data),
};

export type GoalInput = { goalType: GoalType; goalName: string; targetValue: number; targetDate: string; startDate?: string; startingValue?: number };
export const goalsApi = {
  list: (params?: Query) => list<FitnessGoal>('/fitness-goals', params),
  get: (id: number) => api.get<FitnessGoal>(`/fitness-goals/${id}`).then((r) => r.data),
  create: (data: GoalInput) => api.post<FitnessGoal>('/fitness-goals', data).then((r) => r.data),
  update: (id: number, data: Partial<Pick<GoalInput, 'goalName' | 'targetValue' | 'targetDate' | 'startingValue'>>) =>
    api.patch<FitnessGoal>(`/fitness-goals/${id}`, data).then((r) => r.data),
  cancel: (id: number) => api.patch<FitnessGoal>(`/fitness-goals/${id}`, { status: 'Cancelled' }).then((r) => r.data),
};

export type FeedbackInput = { memberId: number; feedbackType: FeedbackType; feedbackMessage: string; relatedGoalId?: number | null; relatedPlanId?: number | null };
export type FeedbackPage = Page<TrainerFeedback> & { unread: number | null };
export const feedbackApi = {
  list: async (params?: Query): Promise<FeedbackPage> => {
    const res = await api.get<TrainerFeedback[]>('/trainer-feedback', { params: clean(params) });
    const unread = res.headers['x-unread-count'];
    return { ...toPage(res), unread: unread === undefined ? null : Number(unread) };
  },
  create: (data: FeedbackInput) => api.post<TrainerFeedback>('/trainer-feedback', data).then((r) => r.data),
  update: (id: number, data: Partial<Omit<FeedbackInput, 'memberId'>>) => api.patch<TrainerFeedback>(`/trainer-feedback/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/trainer-feedback/${id}`),
  markRead: (id: number) => api.patch<TrainerFeedback>(`/trainer-feedback/${id}/read`).then((r) => r.data),
};
