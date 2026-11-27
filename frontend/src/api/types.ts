/** TypeScript shapes of the FitSync API responses (camelCase, Lab 05). */
import type { AdminFitness, AdminReportFitness, MemberFitness, MemberReportFitness, TrainerFitness, TrainerReportFitness, WorkoutCompletion } from './fitness-types';

export * from './fitness-types';

export type Role = 'Member' | 'Trainer' | 'Admin';

export interface User {
  userId: number;
  fullName: string;
  email: string;
  role: Role;
  createdAt: string;
  profileImg: string | null;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: User;
}

export interface Exercise {
  exerciseId: number;
  exerciseName: string;
  category: string;
  description: string | null;
  /** null for local exercises; licence attribution for exercises imported from wger. */
  source?: ExerciseSource | null;
}

export interface TrainerAssignment {
  assignmentId: number;
  trainerId: number;
  memberId: number;
  assignedAt: string;
  trainer?: User;
  member?: User;
}

export interface PlanExercise {
  planExerciseId: number;
  planId: number;
  exerciseId: number;
  targetSets: number;
  targetReps: number;
  /** Version 2.0 (migration 003): total minutes for a timed exercise; null = repetition-based. */
  targetDurationMinutes?: number | null;
  exercise?: Exercise;
}

export interface WorkoutPlan {
  planId: number;
  trainerId: number;
  memberId: number;
  planName: string;
  createdAt: string;
  trainer?: User;
  member?: User;
  planExercises?: PlanExercise[];
}

export interface WorkoutLog {
  logId: number;
  memberId: number;
  exerciseId: number;
  workoutDate: string;
  sets: number;
  repetitions: number;
  durationMinutes: number;
  exercise?: Exercise;
  member?: User;
  /** Version 2.0: present on POST /workout-logs responses when logged from a plan. */
  completion?: WorkoutCompletion | null;
}

export interface ProgressRecord {
  progressId: number;
  memberId: number;
  recordDate: string;
  weightKg: number | null;
  notes: string | null;
  member?: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DailyActivity {
  date: string;
  workouts: number;
  minutes: number;
}

export interface MemberDashboard {
  summary: {
    totalWorkouts: number;
    totalMinutes: number;
    workoutsThisWeek: number;
    minutesThisWeek: number;
    currentStreakDays: number;
    activePlans: number;
    latestWeightKg: number | null;
    weightChangeKg: number | null;
  };
  activity: DailyActivity[];
  weightTrend: { date: string; weightKg: number }[];
  categoryBreakdown: { category: string; count: number }[];
  recentWorkouts: WorkoutLog[];
  trainers: User[];
  /** Version 2.0 additions. */
  fitness: MemberFitness;
}

export interface TrainerMemberSummary {
  assignmentId: number;
  assignedAt: string;
  member: User;
  lastWorkoutDate: string | null;
  workoutsLast7Days: number;
  workoutsLast30Days: number;
  latestWeightKg: number | null;
  planCount: number;
}

export interface TrainerDashboard {
  summary: {
    assignedMembers: number;
    plansCreated: number;
    memberWorkoutsLast7Days: number;
    memberMinutesLast7Days: number;
    activeMembersLast7Days: number;
  };
  members: TrainerMemberSummary[];
  activity: DailyActivity[];
  recentWorkouts: WorkoutLog[];
  /** Version 2.0 additions. */
  fitness: TrainerFitness;
}

export interface AdminDashboard {
  users: { total: number; members: number; trainers: number; admins: number; active: number; inactive: number };
  totals: {
    exercises: number;
    workoutPlans: number;
    workoutLogs: number;
    progressRecords: number;
    trainerAssignments: number;
    unassignedMembers: number;
  };
  registrations: { month: string; count: number }[];
  activity: DailyActivity[];
  topExercises: { exerciseName: string; count: number }[];
  exercisesByCategory: { category: string; count: number }[];
  recentUsers: User[];
  /** Version 2.0 additions (aggregates only). */
  fitness: AdminFitness;
}

/** Lab 05 error envelope. */
export interface ApiErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors: string[];
  timestamp: string;
}

// ---------------------------------------------------------------- External Fitness API (wger)
export interface ExerciseSource {
  provider: string;
  externalId: number;
  sourceUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  author: string | null;
  importedAt: string | null;
}

export interface ExternalImage {
  url: string;
  thumbnailUrl: string;
  isMain: boolean;
  license: string;
  licenseUrl: string | null;
  author: string | null;
  authorUrl: string | null;
  sourceUrl: string | null;
}

export interface ExternalExercise {
  externalId: number;
  provider: 'wger';
  name: string;
  language: 'en' | 'other';
  category: { id: number; name: string } | null;
  description: string;
  muscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  images: ExternalImage[];
  attribution: { sourceUrl: string; license: string | null; licenseUrl: string | null; author: string | null; text: string };
  localExerciseId: number | null;
}

export interface Named {
  id: number;
  name: string;
}

// ---------------------------------------------------------------- Reports
export interface ReportRangeInfo {
  period: 'week' | 'month' | 'custom';
  from: string;
  to: string;
  days: number;
}

export interface ActivityTotals {
  totalWorkouts: number;
  totalDurationMinutes: number;
  totalSets: number;
  totalRepetitions: number;
  distinctWorkoutDays: number;
  consistencyPercent: number;
  averageMinutesPerWorkoutDay: number;
  averageWorkoutsPerWeek: number;
  longestStreakDays: number;
}

export interface MemberReport {
  reportType: 'member';
  generatedAt: string;
  range: ReportRangeInfo;
  member: { userId: number; fullName: string; email: string };
  summary: ActivityTotals;
  daily: DailyActivity[];
  exerciseFrequency: { exerciseId: number; exerciseName: string; category: string; workouts: number; sets: number; repetitions: number; minutes: number }[];
  categoryBreakdown: { category: string; workouts: number; minutes: number; percent: number }[];
  weight: {
    measurements: number;
    startDate: string | null;
    startWeightKg: number | null;
    endDate: string | null;
    endWeightKg: number | null;
    changeKg: number | null;
    minKg: number | null;
    maxKg: number | null;
    trend: { date: string; weightKg: number }[];
  };
  notes: { date: string; notes: string }[];
  /** Version 2.0 additions. */
  fitness: MemberReportFitness;
}

export interface TrainerReportMember {
  member: { userId: number; fullName: string; email: string };
  assignedAt: string;
  totalWorkouts: number;
  totalDurationMinutes: number;
  totalSets: number;
  totalRepetitions: number;
  distinctWorkoutDays: number;
  consistencyPercent: number;
  lastWorkoutDate: string | null;
  latestWeightKg: number | null;
  weightChangeKg: number | null;
  planCount: number;
}

export interface TrainerReport {
  reportType: 'trainer';
  generatedAt: string;
  range: ReportRangeInfo;
  trainer: { userId: number; fullName: string; email: string };
  summary: {
    assignedMembers: number;
    activeMembers: number;
    totalWorkouts: number;
    totalDurationMinutes: number;
    averageWorkoutsPerMember: number;
    averageConsistencyPercent: number;
    plansCreatedInRange: number;
  };
  members: TrainerReportMember[];
  daily: DailyActivity[];
  /** Version 2.0 additions. */
  fitness: TrainerReportFitness;
}

export interface AdminReport {
  reportType: 'admin';
  generatedAt: string;
  range: ReportRangeInfo;
  seriesGranularity: 'day' | 'month';
  users: { total: number; active: number; inactive: number; byRole: { role: Role; total: number; active: number }[] };
  registrations: { inRange: number; byRole: { role: Role; count: number }[]; series: { period: string; count: number }[] };
  activity: {
    totalWorkouts: number;
    totalDurationMinutes: number;
    activeMembers: number;
    averageWorkoutsPerActiveMember: number;
    series: { period: string; workouts: number; minutes: number }[];
  };
  topExercises: { exerciseId: number; exerciseName: string; category: string; workouts: number }[];
  assignments: {
    total: number;
    createdInRange: number;
    trainers: { trainerId: number; fullName: string; assignedMembers: number }[];
    averageMembersPerTrainer: number;
    unassignedActiveMembers: number;
  };
  usage: { workoutLogs: number; progressRecords: number; workoutPlansCreated: number; exercisesImported: number; activeUsers: number };
  /** Version 2.0 additions (aggregates only). */
  fitness: AdminReportFitness;
}
