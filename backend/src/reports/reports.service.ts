import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { localDateOf, localDayEnd, localDayStart } from '../common/utils/date.util';
import { forbidden, notFound } from '../common/utils/http-errors';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { enumerateDates, ReportRange } from './report-range';
import { FitnessGoalsService, type EvaluatedGoal } from '../fitness-goals/fitness-goals.service';
import { TrainerFeedbackService } from '../trainer-feedback/trainer-feedback.service';
import { averagePercent } from '../workout-completions/completion-calculator';
import { ratioOf, WorkoutCompletionsService } from '../workout-completions/workout-completions.service';

/*
 * METRIC DEFINITIONS (all computed from database rows inside the date range,
 * both ends inclusive; WorkoutDate / RecordDate are calendar dates):
 *
 *   totalWorkouts            number of WorkoutLogs rows
 *   totalDurationMinutes     SUM(DurationMinutes)
 *   totalSets                SUM(Sets)
 *   totalRepetitions         SUM(Sets × Repetitions)  (Repetitions = reps per set)
 *   distinctWorkoutDays      number of different WorkoutDate values
 *   consistencyPercent       distinctWorkoutDays ÷ days in range × 100 (1 decimal)
 *   averageMinutesPerWorkoutDay  totalDurationMinutes ÷ distinctWorkoutDays
 *   averageWorkoutsPerWeek   totalWorkouts ÷ days in range × 7
 *   longestStreakDays        longest run of consecutive days with ≥ 1 workout
 *   weight.start / end       first / last ProgressRecords weight in the range
 *   weight.changeKg          end − start (negative = weight lost)
 *   activeMembers            members with ≥ 1 workout log in the range
 * Empty ranges return zeros, empty lists and null weights — never an error.
 *
 * VERSION 2.0 additions (new `fitness` key; every field above is unchanged):
 *   plan completion          per workout-completions/completion-calculator.ts,
 *                            measured over the report range
 *   goals                    goals whose period overlaps the range, with progress
 *                            evaluated on the generation date (goal-progress.ts)
 *   feedback                 COUNTS only (given / read / unread in the range) —
 *                            report exports never contain feedback messages
 */

export interface DailyPoint {
  date: string;
  workouts: number;
  minutes: number;
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

export interface WeightSummary {
  measurements: number;
  startDate: string | null;
  startWeightKg: number | null;
  endDate: string | null;
  endWeightKg: number | null;
  changeKg: number | null;
  minKg: number | null;
  maxKg: number | null;
  trend: { date: string; weightKg: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v ?? 0) || 0;
const rangeMeta = (range: ReportRange) => ({ period: range.period, from: range.from, to: range.to, days: range.days });
const userSummary = (u: User) => ({ userId: u.userId, fullName: u.fullName, email: u.email });

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    @InjectRepository(ProgressRecord) private readonly progress: Repository<ProgressRecord>,
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    @InjectRepository(TrainerAssignment) private readonly assignments: Repository<TrainerAssignment>,
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
    private readonly assignmentsService: TrainerAssignmentsService,
    private readonly completionsService: WorkoutCompletionsService,
    private readonly goalsService: FitnessGoalsService,
    private readonly feedbackService: TrainerFeedbackService,
  ) {}

  // ============================================================== MEMBER
  async memberReport(memberId: number, range: ReportRange) {
    const member = await this.users.findOne({ where: { userId: memberId } });
    if (!member) throw notFound('Member not found.', 'Member ID does not exist.');

    const [daily, exerciseRows, weight, notes] = await Promise.all([
      this.daily([memberId], range),
      this.logs
        .createQueryBuilder('log')
        .innerJoin('log.exercise', 'exercise')
        .select('exercise.exerciseId', 'exerciseId')
        .addSelect('exercise.exerciseName', 'exerciseName')
        .addSelect('exercise.category', 'category')
        .addSelect('COUNT(*)', 'workouts')
        .addSelect('SUM(log.sets)', 'sets')
        .addSelect('SUM(log.sets * log.repetitions)', 'repetitions')
        .addSelect('SUM(log.durationMinutes)', 'minutes')
        .where('log.memberId = :memberId', { memberId })
        .andWhere('log.workoutDate BETWEEN :from AND :to', range)
        .groupBy('exercise.exerciseId')
        .addGroupBy('exercise.exerciseName')
        .addGroupBy('exercise.category')
        .getRawMany(),
      this.weightSummary(memberId, range),
      this.progress.find({
        where: { memberId, recordDate: Between(range.from, range.to) },
        order: { recordDate: 'DESC', progressId: 'DESC' },
        take: 50,
      }),
    ]);

    const exerciseFrequency = exerciseRows
      .map((r) => ({
        exerciseId: num(r.exerciseId),
        exerciseName: String(r.exerciseName),
        category: String(r.category),
        workouts: num(r.workouts),
        sets: num(r.sets),
        repetitions: num(r.repetitions),
        minutes: num(r.minutes),
      }))
      .sort((a, b) => b.workouts - a.workouts || a.exerciseName.localeCompare(b.exerciseName));

    const summary = this.totals(daily, exerciseFrequency, range);
    const byCategory = new Map<string, { workouts: number; minutes: number }>();
    for (const e of exerciseFrequency) {
      const c = byCategory.get(e.category) ?? { workouts: 0, minutes: 0 };
      c.workouts += e.workouts;
      c.minutes += e.minutes;
      byCategory.set(e.category, c);
    }
    const categoryBreakdown = [...byCategory.entries()]
      .map(([category, v]) => ({
        category,
        workouts: v.workouts,
        minutes: v.minutes,
        percent: summary.totalWorkouts ? round1((v.workouts / summary.totalWorkouts) * 100) : 0,
      }))
      .sort((a, b) => b.workouts - a.workouts);

    return {
      reportType: 'member' as const,
      generatedAt: new Date().toISOString(),
      range: rangeMeta(range),
      member: userSummary(member),
      summary,
      daily,
      exerciseFrequency,
      categoryBreakdown,
      weight,
      notes: notes.filter((n) => n.notes).map((n) => ({ date: n.recordDate, notes: n.notes as string })),
      fitness: await this.memberFitness(memberId, range),
    };
  }

  // ============================================================== TRAINER
  /** Comparison of all members assigned to the trainer. */
  async trainerReport(trainerId: number, range: ReportRange) {
    const trainer = await this.users.findOneOrFail({ where: { userId: trainerId } });
    const assigned = await this.assignments.find({
      where: { trainerId },
      relations: { member: true },
      order: { assignedAt: 'ASC' },
    });
    const memberIds = assigned.map((a) => a.memberId);

    const [perMember, daily, weights, plansInRange, planCounts, lastWorkouts] = await Promise.all([
      memberIds.length
        ? this.logs
            .createQueryBuilder('log')
            .select('log.memberId', 'memberId')
            .addSelect('COUNT(*)', 'workouts')
            .addSelect('SUM(log.durationMinutes)', 'minutes')
            .addSelect('SUM(log.sets)', 'sets')
            .addSelect('SUM(log.sets * log.repetitions)', 'repetitions')
            .addSelect('COUNT(DISTINCT log.workoutDate)', 'days')
            .where('log.memberId IN (:...memberIds)', { memberIds })
            .andWhere('log.workoutDate BETWEEN :from AND :to', range)
            .groupBy('log.memberId')
            .getRawMany()
        : [],
      this.daily(memberIds, range),
      memberIds.length
        ? this.progress.find({
            where: { memberId: In(memberIds), recordDate: Between(range.from, range.to) },
            order: { recordDate: 'ASC', progressId: 'ASC' },
          })
        : [],
      this.plans.count({ where: { trainerId, createdAt: Between(localDayStart(range.from), localDayEnd(range.to)) } }),
      memberIds.length
        ? this.plans
            .createQueryBuilder('plan')
            .select('plan.memberId', 'memberId')
            .addSelect('COUNT(*)', 'count')
            .where('plan.trainerId = :trainerId', { trainerId })
            .andWhere('plan.memberId IN (:...memberIds)', { memberIds })
            .groupBy('plan.memberId')
            .getRawMany()
        : [],
      memberIds.length
        ? this.logs
            .createQueryBuilder('log')
            .select('log.memberId', 'memberId')
            .addSelect('MAX(log.workoutDate)', 'last')
            .where('log.memberId IN (:...memberIds)', { memberIds })
            .groupBy('log.memberId')
            .getRawMany()
        : [],
    ]);

    const members = assigned
      .map((a) => {
        const stats = perMember.find((p) => num(p.memberId) === a.memberId);
        const memberWeights = weights.filter((w) => w.memberId === a.memberId && w.weightKg !== null);
        const first = memberWeights[0]?.weightKg ?? null;
        const last = memberWeights.at(-1)?.weightKg ?? null;
        const days = num(stats?.days);
        return {
          member: userSummary(a.member!),
          assignedAt: a.assignedAt,
          totalWorkouts: num(stats?.workouts),
          totalDurationMinutes: num(stats?.minutes),
          totalSets: num(stats?.sets),
          totalRepetitions: num(stats?.repetitions),
          distinctWorkoutDays: days,
          consistencyPercent: round1((days / range.days) * 100),
          lastWorkoutDate: (lastWorkouts.find((l) => num(l.memberId) === a.memberId)?.last as string) ?? null,
          latestWeightKg: last,
          weightChangeKg: first !== null && last !== null && memberWeights.length > 1 ? round2(last - first) : null,
          planCount: num(planCounts.find((p) => num(p.memberId) === a.memberId)?.count),
        };
      })
      .sort((a, b) => b.totalWorkouts - a.totalWorkouts || a.member.fullName.localeCompare(b.member.fullName));

    const totalWorkouts = members.reduce((s, m) => s + m.totalWorkouts, 0);
    return {
      reportType: 'trainer' as const,
      generatedAt: new Date().toISOString(),
      range: rangeMeta(range),
      trainer: userSummary(trainer),
      summary: {
        assignedMembers: members.length,
        activeMembers: members.filter((m) => m.totalWorkouts > 0).length,
        totalWorkouts,
        totalDurationMinutes: members.reduce((s, m) => s + m.totalDurationMinutes, 0),
        averageWorkoutsPerMember: members.length ? round1(totalWorkouts / members.length) : 0,
        averageConsistencyPercent: members.length ? round1(members.reduce((s, m) => s + m.consistencyPercent, 0) / members.length) : 0,
        plansCreatedInRange: plansInRange,
      },
      members,
      daily,
      fitness: await this.trainerFitness(trainerId, memberIds, range),
    };
  }

  /** One assigned member's full report, for their trainer. 403 if not assigned. */
  async trainerMemberReport(trainerId: number, memberId: number, range: ReportRange) {
    if (!(await this.assignmentsService.isAssigned(trainerId, memberId))) {
      throw forbidden('Not authorized to view reports for this member.');
    }
    return this.memberReport(memberId, range);
  }

  // ============================================================== ADMIN
  async adminReport(range: ReportRange) {
    // Report days are app-time-zone days; stored instants are UTC.
    const fromTs = localDayStart(range.from);
    const toTs = localDayEnd(range.to);
    const monthly = range.days > 62;
    const bucket = (date: string) => (monthly ? date.slice(0, 7) : date);

    const [roleRows, registrations, activity, topExercises, assignmentRows, assignedMemberIds, createdAssignments, progressCount, plansCreated, imported, activeUsers] =
      await Promise.all([
        this.users
          .createQueryBuilder('u')
          .select('u.role', 'role')
          .addSelect('COUNT(*)', 'total')
          .addSelect('SUM(CASE WHEN u.isActive = 1 THEN 1 ELSE 0 END)', 'active')
          .groupBy('u.role')
          .getRawMany(),
        this.users.find({ where: { createdAt: Between(fromTs, toTs) }, select: { userId: true, role: true, createdAt: true } }),
        this.logs
          .createQueryBuilder('log')
          .select('COUNT(*)', 'workouts')
          .addSelect('COALESCE(SUM(log.durationMinutes), 0)', 'minutes')
          .addSelect('COUNT(DISTINCT log.memberId)', 'members')
          .where('log.workoutDate BETWEEN :from AND :to', range)
          .getRawOne(),
        this.logs
          .createQueryBuilder('log')
          .innerJoin('log.exercise', 'exercise')
          .select('exercise.exerciseId', 'exerciseId')
          .addSelect('exercise.exerciseName', 'exerciseName')
          .addSelect('exercise.category', 'category')
          .addSelect('COUNT(*)', 'workouts')
          .where('log.workoutDate BETWEEN :from AND :to', range)
          .groupBy('exercise.exerciseId')
          .addGroupBy('exercise.exerciseName')
          .addGroupBy('exercise.category')
          .orderBy('workouts', 'DESC')
          .addOrderBy('exercise.exerciseName', 'ASC')
          .limit(10)
          .getRawMany(),
        this.assignments
          .createQueryBuilder('a')
          .innerJoin('a.trainer', 'trainer')
          .select('trainer.userId', 'trainerId')
          .addSelect('trainer.fullName', 'fullName')
          .addSelect('COUNT(*)', 'members')
          .groupBy('trainer.userId')
          .addGroupBy('trainer.fullName')
          .orderBy('members', 'DESC')
          .getRawMany(),
        this.assignments.createQueryBuilder('a').select('DISTINCT a.memberId', 'memberId').getRawMany(),
        this.assignments.count({ where: { assignedAt: Between(fromTs, toTs) } }),
        this.progress.count({ where: { recordDate: Between(range.from, range.to) } }),
        this.plans.count({ where: { createdAt: Between(fromTs, toTs) } }),
        this.exercises.count({ where: { importedAt: Between(fromTs, toTs) } }),
        this.users
          .createQueryBuilder('u')
          .select('COUNT(DISTINCT u.userId)', 'count')
          .where(
            `u.userId IN (SELECT l.MemberID FROM WorkoutLogs l WHERE l.WorkoutDate BETWEEN :from AND :to
              UNION SELECT p.MemberID FROM ProgressRecords p WHERE p.RecordDate BETWEEN :from AND :to)`,
            range,
          )
          .getRawOne(),
      ]);

    const byRole = [Role.Member, Role.Trainer, Role.Admin].map((role) => {
      const row = roleRows.find((r) => r.role === role);
      return { role, total: num(row?.total), active: num(row?.active) };
    });
    const totalUsers = byRole.reduce((s, r) => s + r.total, 0);
    const activeUsersTotal = byRole.reduce((s, r) => s + r.active, 0);

    // Time series (by day for ranges up to 62 days, otherwise by month).
    const buckets = [...new Set(enumerateDates(range.from, range.to).map(bucket))];
    const daily = await this.daily(null, range);
    const activitySeries = buckets.map((period) => {
      const points = daily.filter((d) => bucket(d.date) === period);
      return { period, workouts: points.reduce((s, p) => s + p.workouts, 0), minutes: points.reduce((s, p) => s + p.minutes, 0) };
    });
    const registrationSeries = buckets.map((period) => ({
      period,
      count: registrations.filter((u) => bucket(localDateOf(u.createdAt)) === period).length,
    }));

    const activeMemberIds = new Set(
      (await this.users.find({ where: { role: Role.Member, isActive: true }, select: { userId: true } })).map((u) => u.userId),
    );
    const assignedSet = new Set(assignedMemberIds.map((r) => num(r.memberId)));
    const workouts = num(activity?.workouts);
    const activeMembers = num(activity?.members);
    const trainers = assignmentRows.map((r) => ({ trainerId: num(r.trainerId), fullName: String(r.fullName), assignedMembers: num(r.members) }));
    const trainerCount = byRole.find((r) => r.role === Role.Trainer)!.total;

    return {
      reportType: 'admin' as const,
      generatedAt: new Date().toISOString(),
      range: rangeMeta(range),
      seriesGranularity: monthly ? 'month' : 'day',
      users: { total: totalUsers, active: activeUsersTotal, inactive: totalUsers - activeUsersTotal, byRole },
      registrations: {
        inRange: registrations.length,
        byRole: [Role.Member, Role.Trainer, Role.Admin].map((role) => ({ role, count: registrations.filter((u) => u.role === role).length })),
        series: registrationSeries,
      },
      activity: {
        totalWorkouts: workouts,
        totalDurationMinutes: num(activity?.minutes),
        activeMembers,
        averageWorkoutsPerActiveMember: activeMembers ? round1(workouts / activeMembers) : 0,
        series: activitySeries,
      },
      topExercises: topExercises.map((r) => ({
        exerciseId: num(r.exerciseId),
        exerciseName: String(r.exerciseName),
        category: String(r.category),
        workouts: num(r.workouts),
      })),
      assignments: {
        total: trainers.reduce((s, t) => s + t.assignedMembers, 0),
        createdInRange: createdAssignments,
        trainers,
        averageMembersPerTrainer: trainerCount ? round1(trainers.reduce((s, t) => s + t.assignedMembers, 0) / trainerCount) : 0,
        unassignedActiveMembers: [...activeMemberIds].filter((id) => !assignedSet.has(id)).length,
      },
      usage: {
        workoutLogs: workouts,
        progressRecords: progressCount,
        workoutPlansCreated: plansCreated,
        exercisesImported: imported,
        activeUsers: num(activeUsers?.count),
      },
      fitness: await this.adminFitness(range, fromTs, toTs),
    };
  }

  // ============================================================== VERSION 2.0 sections

  /** Plan completion, goals overlapping the range and feedback counts for one member. */
  private async memberFitness(memberId: number, range: ReportRange) {
    const [rows, goals, feedback] = await Promise.all([
      this.completionsService.adherenceRows([memberId], null, range),
      this.goalsService.evaluatedForMembers([memberId]),
      this.feedbackService.countForMember(memberId, localDayStart(range.from), localDayEnd(range.to)),
    ]);
    const row = rows[0];
    return {
      planCompletion: {
        completionPercent: row?.completionPercent ?? null,
        prescribedExercises: row?.prescribedExercises ?? 0,
        completedExercises: row?.completedExercises ?? 0,
        partialExercises: row?.partialExercises ?? 0,
        pendingExercises: row?.pendingExercises ?? 0,
        planWorkouts: row?.planWorkouts ?? 0,
        otherWorkouts: row?.otherWorkouts ?? 0,
        plans: (row?.plans ?? []).map((p) => ({
          planName: p.planName,
          trainerName: p.trainer?.fullName ?? null,
          prescribedExercises: p.prescribedExercises,
          completedExercises: p.completedExercises,
          partialExercises: p.partialExercises,
          pendingExercises: p.pendingExercises,
          completionPercent: p.completionPercent,
        })),
      },
      goals: goals.filter((g) => this.overlaps(g, range)).map((g) => this.goalRow(g)),
      feedback: { receivedInPeriod: feedback.received, unreadNow: feedback.unread },
    };
  }

  private async trainerFitness(trainerId: number, memberIds: number[], range: ReportRange) {
    const [rows, goals, sent] = await Promise.all([
      this.completionsService.adherenceRows(memberIds, trainerId, range),
      this.goalsService.evaluatedForMembers(memberIds),
      this.feedbackService.countsForTrainer(trainerId, localDayStart(range.from), localDayEnd(range.to)),
    ]);
    const members = rows.map((r) => {
      const memberGoals = goals.filter((g) => g.goal.memberId === r.member.userId);
      const active = memberGoals.filter((g) => g.goal.status === 'Active');
      const s = sent.find((x) => x.memberId === r.member.userId);
      return {
        member: { userId: r.member.userId, fullName: r.member.fullName, email: r.member.email ?? '' },
        completionPercent: r.completionPercent,
        prescribedExercises: r.prescribedExercises,
        completedExercises: r.completedExercises,
        partialExercises: r.partialExercises,
        pendingExercises: r.pendingExercises,
        planWorkouts: r.planWorkouts,
        activeGoals: active.length,
        goalsBehind: active.filter((g) => g.progress.state === 'Behind').length,
        goalsCompletedInPeriod: memberGoals.filter(
          (g) => g.goal.status === 'Completed' && g.progress.achievedOn !== null && g.progress.achievedOn >= range.from && g.progress.achievedOn <= range.to,
        ).length,
        feedbackGiven: s?.sent ?? 0,
        feedbackUnread: s?.unread ?? 0,
      };
    });
    const withPlans = members.filter((m) => m.completionPercent !== null);
    return {
      summary: {
        averageCompletionPercent: averagePercent(rows.map(ratioOf)),
        membersWithPlans: withPlans.length,
        activeGoals: members.reduce((s, m) => s + m.activeGoals, 0),
        goalsBehind: members.reduce((s, m) => s + m.goalsBehind, 0),
        feedbackGiven: members.reduce((s, m) => s + m.feedbackGiven, 0),
      },
      members,
    };
  }

  /** Aggregates only — no names, no goal names, no feedback messages. */
  private async adminFitness(range: ReportRange, fromTs: Date, toTs: Date) {
    const [rows, goals, feedback] = await Promise.all([
      this.completionsService.adherenceRows(null, null, range),
      this.goalsService.statistics(null),
      this.feedbackService.statistics({ from: fromTs, to: toTs }),
    ]);
    const withPlans = rows.filter((r) => r.completionPercent !== null);
    const sum = (k: 'prescribedExercises' | 'completedExercises' | 'partialExercises' | 'pendingExercises' | 'planWorkouts' | 'otherWorkouts') =>
      rows.reduce((s, r) => s + r[k], 0);
    return {
      completion: {
        membersWithPlans: withPlans.length,
        averageCompletionPercent: averagePercent(rows.map(ratioOf)),
        prescribedExercises: sum('prescribedExercises'),
        completedExercises: sum('completedExercises'),
        partialExercises: sum('partialExercises'),
        pendingExercises: sum('pendingExercises'),
        planWorkouts: sum('planWorkouts'),
        otherWorkouts: sum('otherWorkouts'),
      },
      goals,
      feedback,
    };
  }

  private overlaps(g: EvaluatedGoal, range: ReportRange): boolean {
    return g.goal.startDate <= range.to && g.goal.targetDate >= range.from;
  }

  private goalRow({ goal, progress }: EvaluatedGoal) {
    return {
      goalName: goal.goalName,
      goalType: goal.goalType,
      status: goal.status,
      state: progress.state,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      startingValue: goal.startingValue,
      targetValue: goal.targetValue,
      currentValue: progress.currentValue,
      unit: progress.unit,
      progressPercent: progress.progressPercent,
      weeksMet: progress.weekly?.weeksMet ?? null,
      totalWeeks: progress.weekly?.totalWeeks ?? null,
    };
  }

  // ============================================================== helpers

  /** One point per day in the range (zeros included). memberIds null = everyone. */
  private async daily(memberIds: number[] | null, range: ReportRange): Promise<DailyPoint[]> {
    const dates = enumerateDates(range.from, range.to);
    if (memberIds && memberIds.length === 0) return dates.map((date) => ({ date, workouts: 0, minutes: 0 }));
    const qb = this.logs
      .createQueryBuilder('log')
      .select('log.workoutDate', 'date')
      .addSelect('COUNT(*)', 'workouts')
      .addSelect('SUM(log.durationMinutes)', 'minutes')
      .where('log.workoutDate BETWEEN :from AND :to', range)
      .groupBy('log.workoutDate');
    if (memberIds) qb.andWhere('log.memberId IN (:...memberIds)', { memberIds });
    const rows = await qb.getRawMany();
    const byDate = new Map(rows.map((r) => [String(r.date), r]));
    return dates.map((date) => ({ date, workouts: num(byDate.get(date)?.workouts), minutes: num(byDate.get(date)?.minutes) }));
  }

  private totals(daily: DailyPoint[], exercises: { sets: number; repetitions: number }[], range: ReportRange): ActivityTotals {
    const totalWorkouts = daily.reduce((s, d) => s + d.workouts, 0);
    const totalDurationMinutes = daily.reduce((s, d) => s + d.minutes, 0);
    const distinctWorkoutDays = daily.filter((d) => d.workouts > 0).length;
    let longest = 0;
    let current = 0;
    for (const d of daily) {
      current = d.workouts > 0 ? current + 1 : 0;
      longest = Math.max(longest, current);
    }
    return {
      totalWorkouts,
      totalDurationMinutes,
      totalSets: exercises.reduce((s, e) => s + e.sets, 0),
      totalRepetitions: exercises.reduce((s, e) => s + e.repetitions, 0),
      distinctWorkoutDays,
      consistencyPercent: round1((distinctWorkoutDays / range.days) * 100),
      averageMinutesPerWorkoutDay: distinctWorkoutDays ? round1(totalDurationMinutes / distinctWorkoutDays) : 0,
      averageWorkoutsPerWeek: round1((totalWorkouts / range.days) * 7),
      longestStreakDays: longest,
    };
  }

  private async weightSummary(memberId: number, range: ReportRange): Promise<WeightSummary> {
    const records = await this.progress.find({
      where: { memberId, recordDate: Between(range.from, range.to) },
      order: { recordDate: 'ASC', progressId: 'ASC' },
    });
    const weighed = records.filter((r) => r.weightKg !== null) as (ProgressRecord & { weightKg: number })[];
    if (weighed.length === 0) {
      return { measurements: 0, startDate: null, startWeightKg: null, endDate: null, endWeightKg: null, changeKg: null, minKg: null, maxKg: null, trend: [] };
    }
    const first = weighed[0];
    const last = weighed[weighed.length - 1];
    const values = weighed.map((w) => w.weightKg);
    return {
      measurements: weighed.length,
      startDate: first.recordDate,
      startWeightKg: first.weightKg,
      endDate: last.recordDate,
      endWeightKg: last.weightKg,
      changeKg: weighed.length > 1 ? round2(last.weightKg - first.weightKg) : null,
      minKg: Math.min(...values),
      maxKg: Math.max(...values),
      trend: weighed.map((w) => ({ date: w.recordDate, weightKg: w.weightKg })),
    };
  }
}
