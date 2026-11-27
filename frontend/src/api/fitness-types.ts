/** Version 2.0 API shapes: workout plan completion, fitness goals and trainer feedback. */

type Person = { userId: number; fullName: string; email?: string };
type Range = { period?: string; from: string; to: string; days: number };

// ---------------------------------------------------------------- Workout plan completion
export type CompletionStatus = 'completed' | 'partial' | 'pending';

/** A prescription: sets × reps, or (durationMinutes set) a timed exercise scored on sets + minutes. */
export interface Prescribed {
  sets: number;
  reps: number;
  durationMinutes?: number | null;
}

export interface WorkoutCompletion {
  completionId: number;
  logId: number;
  memberId: number;
  planId: number | null;
  planName: string;
  planExerciseId: number | null;
  planExerciseRemoved: boolean;
  workoutDate: string;
  exercise: { exerciseId: number; exerciseName: string; category: string } | null;
  prescribed: Prescribed;
  actual: { sets: number; repetitions: number; durationMinutes: number };
  scorePercent: number;
  status: Exclude<CompletionStatus, 'pending'>;
  createdAt: string;
}

export interface PlanCompletionExercise {
  planExerciseId: number;
  exercise: { exerciseId: number; exerciseName: string; category: string } | null;
  prescribed: Prescribed;
  status: CompletionStatus;
  scorePercent: number;
  attempts: number;
  lastWorkoutDate: string | null;
  best: {
    completionId: number;
    logId: number;
    workoutDate: string;
    actual: { sets: number; repetitions: number; durationMinutes: number };
    prescribedAtTheTime: Prescribed;
  } | null;
}

export interface CompletionCounts {
  prescribedExercises: number;
  completedExercises: number;
  partialExercises: number;
  pendingExercises: number;
  completionPercent: number | null;
}

export interface PlanCompletion {
  plan: { planId: number; planName: string; createdAt: string; countsFrom: string; member: Person | null; trainer: Person | null };
  range: Range;
  summary: CompletionCounts & { linkedWorkouts: number };
  exercises: PlanCompletionExercise[];
}

export interface AdherencePlan extends CompletionCounts {
  planId: number;
  planName: string;
  trainer: Person | null;
}

export interface AdherenceRow extends CompletionCounts {
  member: Person;
  plans: AdherencePlan[];
  workoutsInPeriod: number;
  planWorkouts: number;
  otherWorkouts: number;
  lastWorkoutDate: string | null;
}

export interface Adherence {
  range: Range;
  summary: { members: number; membersWithPlans: number; averageCompletionPercent: number | null };
  members: AdherenceRow[];
}

// ---------------------------------------------------------------- Fitness goals
export type GoalType = 'TargetWeight' | 'WeeklyWorkouts' | 'WeeklyMinutes';
export type GoalStatus = 'Active' | 'Completed' | 'Missed' | 'Cancelled';
export type GoalState = 'Upcoming' | 'NoData' | 'InProgress' | 'OnTrack' | 'Behind' | 'Achieved' | 'Missed' | 'Cancelled';

export interface GoalWeek {
  index: number;
  from: string;
  to: string;
  value: number;
  target: number;
  met: boolean;
  finished: boolean;
  percent: number;
}

export interface GoalProgress {
  state: GoalState;
  achieved: boolean;
  achievedOn: string | null;
  progressPercent: number | null;
  currentValue: number | null;
  unit: 'kg' | 'workout days' | 'minutes';
  evaluatedThrough: string;
  timeElapsedPercent: number;
  daysRemaining: number;
  /** Closed goals: the current records no longer match the stored outcome (changed after closing). */
  evidenceChanged?: boolean;
  /** Progress measured from the current records (differs from progressPercent for Completed goals whose records changed). */
  liveProgressPercent?: number | null;
  weight: {
    direction: 'loss' | 'gain';
    startingKg: number;
    targetKg: number;
    latestKg: number | null;
    latestDate: string | null;
    changeKg: number | null;
    remainingKg: number | null;
    measurements: number;
  } | null;
  weekly: {
    totalWeeks: number;
    finishedWeeks: number;
    weeksMet: number;
    currentWeek: GoalWeek | null;
    weeks?: GoalWeek[];
  } | null;
}

export interface FitnessGoal {
  goalId: number;
  memberId: number;
  member?: { userId: number; fullName: string };
  goalType: GoalType;
  goalName: string;
  startingValue: number | null;
  targetValue: number;
  startDate: string;
  targetDate: string;
  status: GoalStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  progress: GoalProgress;
}

export interface GoalStatistics {
  total: number;
  byStatus: Record<GoalStatus, number>;
  byType: { goalType: GoalType; total: number; active: number; completed: number }[];
  activeByState: { onTrack: number; behind: number; noData: number; upcoming: number };
  achievementRatePercent: number | null;
  averageActiveProgressPercent: number | null;
  membersWithActiveGoals: number;
}

// ---------------------------------------------------------------- Trainer feedback
export type FeedbackType = 'General' | 'Encouragement' | 'Guidance' | 'Concern';

export interface TrainerFeedback {
  feedbackId: number;
  trainerId: number;
  memberId: number;
  trainer: { userId: number; fullName: string } | null;
  member: { userId: number; fullName: string } | null;
  feedbackType: FeedbackType;
  feedbackMessage: string;
  relatedGoalId: number | null;
  relatedPlanId: number | null;
  relatedGoal: { goalId: number; goalName: string; goalType: GoalType } | null;
  relatedPlan: { planId: number; planName: string } | null;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  readAt: string | null;
  isRead: boolean;
}

export interface FeedbackStatistics {
  total: number;
  read: number;
  unread: number;
  readRatePercent: number | null;
  trainersGivingFeedback: number;
  membersReceivingFeedback: number;
  aboutGoals: number;
  aboutPlans: number;
  byType: { feedbackType: FeedbackType; count: number }[];
}

// ---------------------------------------------------------------- Dashboard additions (`fitness` key)
export interface MemberFitness {
  planCompletion: CompletionCounts & { range: Range; plans: AdherencePlan[] };
  activeGoals: FitnessGoal[];
  feedback: { unread: number; recent: TrainerFeedback[] };
}

export interface TrainerFitnessMember {
  member: Person;
  completionPercent: number | null;
  prescribedExercises: number;
  completedExercises: number;
  pendingExercises: number;
  planWorkouts: number;
  workoutsLast7Days: number;
  lastWorkoutDate: string | null;
  activeGoals: number;
  goalsBehind: number;
  feedbackSent: number;
  feedbackUnread: number;
  lastFeedbackAt: string | null;
  attentionReasons: string[];
}

export interface TrainerFitness {
  range: Range;
  attentionCriteria: string[];
  summary: {
    averageCompletionPercent: number | null;
    membersWithPlans: number;
    membersRequiringAttention: number;
    activeGoals: number;
    goalsOnTrack: number;
    goalsBehind: number;
    goalsNoData: number;
    feedbackSentLast30Days: number;
    feedbackUnreadByMembers: number;
  };
  members: TrainerFitnessMember[];
  activeGoals: FitnessGoal[];
  recentFeedback: TrainerFeedback[];
}

export interface AdminFitness {
  completion: Omit<CompletionCounts, 'completionPercent'> & {
    range: Range;
    membersWithPlans: number;
    averageCompletionPercent: number | null;
    planWorkouts: number;
    otherWorkouts: number;
  };
  goals: GoalStatistics;
  feedback: FeedbackStatistics & { last30Days: number };
}

// ---------------------------------------------------------------- Report additions (`fitness` key)
export interface ReportGoalRow {
  goalName: string;
  goalType: GoalType;
  status: GoalStatus;
  state: GoalState;
  startDate: string;
  targetDate: string;
  startingValue: number | null;
  targetValue: number;
  currentValue: number | null;
  unit: GoalProgress['unit'];
  progressPercent: number | null;
  weeksMet: number | null;
  totalWeeks: number | null;
}

export interface MemberReportFitness {
  planCompletion: Omit<CompletionCounts, 'completionPercent'> & {
    completionPercent: number | null;
    planWorkouts: number;
    otherWorkouts: number;
    plans: (CompletionCounts & { planName: string; trainerName: string | null })[];
  };
  goals: ReportGoalRow[];
  feedback: { receivedInPeriod: number; unreadNow: number };
}

export interface TrainerReportFitness {
  summary: { averageCompletionPercent: number | null; membersWithPlans: number; activeGoals: number; goalsBehind: number; feedbackGiven: number };
  members: (CompletionCounts & {
    member: { userId: number; fullName: string; email: string };
    planWorkouts: number;
    activeGoals: number;
    goalsBehind: number;
    goalsCompletedInPeriod: number;
    feedbackGiven: number;
    feedbackUnread: number;
  })[];
}

export interface AdminReportFitness {
  completion: Omit<AdminFitness['completion'], 'range'>;
  goals: GoalStatistics;
  feedback: FeedbackStatistics;
}
