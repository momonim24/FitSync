import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { daysFromToday, localDayEnd, localDayStart } from '../common/utils/date.util';
import { FitnessGoalsService } from '../fitness-goals/fitness-goals.service';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { TrainerFeedbackService } from '../trainer-feedback/trainer-feedback.service';
import { averagePercent } from '../workout-completions/completion-calculator';
import { ratioOf, resolveCompletionRange, WorkoutCompletionsService } from '../workout-completions/workout-completions.service';

/*
 * "MEMBERS REQUIRING ATTENTION" (trainer dashboard) — a member is listed
 * when at least one of these is true; every reason is shown:
 *   1. no workout logged in the last 7 days (including never)
 *   2. plans from this trainer prescribe exercises, but plan completion in
 *      the last 7 days is below 50 %
 *   3. an active goal is Behind (a finished goal week missed its target)
 *   4. a goal closed as Missed with a target date in the last 30 days
 */
export const ATTENTION_COMPLETION_THRESHOLD = 50;

const range7 = () => resolveCompletionRange({ period: 'week' });
const range30 = () => resolveCompletionRange({ period: 'month' });
const asActor = (userId: number, role: Role): AuthUser => ({ userId, role, email: '', fullName: '' });

/** Version 2.0 data added to each dashboard under the `fitness` key. */
@Injectable()
export class DashboardFitnessService {
  constructor(
    private readonly completions: WorkoutCompletionsService,
    private readonly goals: FitnessGoalsService,
    private readonly feedback: TrainerFeedbackService,
    private readonly assignments: TrainerAssignmentsService,
  ) {}

  async member(memberId: number) {
    const range = range7();
    const [adherence, goals, feedback] = await Promise.all([
      this.completions.adherenceRows([memberId], null, range),
      this.goals.evaluatedForMembers([memberId], ['Active']),
      this.feedback.recent(asActor(memberId, Role.Member), 4),
    ]);
    const row = adherence[0];
    return {
      planCompletion: {
        range: { from: range.from, to: range.to, days: range.days },
        completionPercent: row?.completionPercent ?? null,
        prescribedExercises: row?.prescribedExercises ?? 0,
        completedExercises: row?.completedExercises ?? 0,
        partialExercises: row?.partialExercises ?? 0,
        pendingExercises: row?.pendingExercises ?? 0,
        plans: row?.plans ?? [],
      },
      activeGoals: goals.map((g) => this.goals.toView(g, false)),
      feedback: { unread: feedback.unread ?? 0, recent: feedback.items },
    };
  }

  async trainer(trainerId: number) {
    const memberIds = await this.assignments.assignedMemberIds(trainerId);
    const range = range7();
    const monthAgo = daysFromToday(-30);
    const [adherence, goals, recent, sent30, sentAll] = await Promise.all([
      this.completions.adherenceRows(memberIds, trainerId, range),
      this.goals.evaluatedForMembers(memberIds),
      this.feedback.recent(asActor(trainerId, Role.Trainer), 5),
      this.feedback.countsForTrainer(trainerId, localDayStart(monthAgo)),
      this.feedback.countsForTrainer(trainerId),
    ]);

    const active = goals.filter((g) => g.goal.status === 'Active');
    const weekAgo = daysFromToday(-6);
    const members = adherence.map((row) => {
      const memberGoals = goals.filter((g) => g.goal.memberId === row.member.userId);
      const activeGoals = memberGoals.filter((g) => g.goal.status === 'Active');
      const reasons: string[] = [];
      if (!row.lastWorkoutDate || row.lastWorkoutDate < weekAgo) {
        reasons.push(row.lastWorkoutDate ? 'No workout logged in the last 7 days' : 'No workouts logged yet');
      }
      if (row.prescribedExercises > 0 && (ratioOf(row) ?? 0) * 100 < ATTENTION_COMPLETION_THRESHOLD) {
        reasons.push(`Plan completion ${row.completionPercent ?? 0}% in the last 7 days (below ${ATTENTION_COMPLETION_THRESHOLD}%)`);
      }
      for (const g of activeGoals.filter((x) => x.progress.state === 'Behind')) reasons.push(`Goal behind: ${g.goal.goalName}`);
      for (const g of memberGoals.filter((x) => x.goal.status === 'Missed' && x.goal.targetDate >= monthAgo)) reasons.push(`Goal missed: ${g.goal.goalName}`);
      const sent = sentAll.find((s) => s.memberId === row.member.userId);
      return {
        member: row.member,
        completionPercent: row.completionPercent,
        prescribedExercises: row.prescribedExercises,
        completedExercises: row.completedExercises,
        pendingExercises: row.pendingExercises,
        planWorkouts: row.planWorkouts,
        workoutsLast7Days: row.workoutsInPeriod,
        lastWorkoutDate: row.lastWorkoutDate,
        activeGoals: activeGoals.length,
        goalsBehind: activeGoals.filter((g) => g.progress.state === 'Behind').length,
        feedbackSent: sent?.sent ?? 0,
        feedbackUnread: sent?.unread ?? 0,
        lastFeedbackAt: sent?.lastSentAt ?? null,
        attentionReasons: reasons,
      };
    });
    const withPlans = members.filter((m) => m.completionPercent !== null);

    return {
      range: { from: range.from, to: range.to, days: range.days },
      attentionCriteria: [
        'No workout logged in the last 7 days',
        `Plan completion below ${ATTENTION_COMPLETION_THRESHOLD}% in the last 7 days`,
        'An active goal is behind (a finished goal week missed its target)',
        'A goal was missed in the last 30 days',
      ],
      summary: {
        averageCompletionPercent: averagePercent(adherence.map(ratioOf)),
        membersWithPlans: withPlans.length,
        membersRequiringAttention: members.filter((m) => m.attentionReasons.length).length,
        activeGoals: active.length,
        goalsOnTrack: active.filter((g) => ['OnTrack', 'InProgress'].includes(g.progress.state)).length,
        goalsBehind: active.filter((g) => g.progress.state === 'Behind').length,
        goalsNoData: active.filter((g) => g.progress.state === 'NoData').length,
        feedbackSentLast30Days: sent30.reduce((s, r) => s + r.sent, 0),
        feedbackUnreadByMembers: sentAll.reduce((s, r) => s + r.unread, 0),
      },
      members,
      activeGoals: active.map((g) => this.goals.toView(g, false)),
      recentFeedback: recent.items,
    };
  }

  /** Aggregates only: no goal names, member names or feedback messages. */
  async admin() {
    const range = range30();
    const [adherence, goals, feedbackAll, feedback30] = await Promise.all([
      this.completions.adherenceRows(null, null, range),
      this.goals.statistics(null),
      this.feedback.statistics(),
      this.feedback.statistics({ from: localDayStart(range.from), to: localDayEnd(range.to) }),
    ]);
    const withPlans = adherence.filter((r) => r.completionPercent !== null);
    const sum = (k: 'prescribedExercises' | 'completedExercises' | 'partialExercises' | 'pendingExercises' | 'planWorkouts' | 'otherWorkouts') =>
      adherence.reduce((s, r) => s + r[k], 0);
    return {
      completion: {
        range: { from: range.from, to: range.to, days: range.days },
        membersWithPlans: withPlans.length,
        averageCompletionPercent: averagePercent(adherence.map(ratioOf)),
        prescribedExercises: sum('prescribedExercises'),
        completedExercises: sum('completedExercises'),
        partialExercises: sum('partialExercises'),
        pendingExercises: sum('pendingExercises'),
        planWorkouts: sum('planWorkouts'),
        otherWorkouts: sum('otherWorkouts'),
      },
      goals,
      feedback: { ...feedbackAll, last30Days: feedback30.total },
    };
  }
}
