import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { daysFromToday, lastNDays } from '../common/utils/date.util';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';

interface DailyActivity {
  date: string;
  workouts: number;
  minutes: number;
}

/**
 * Aggregated statistics for the three dashboards. Every number is computed
 * from the database at request time — nothing is hardcoded.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    @InjectRepository(ProgressRecord) private readonly progress: Repository<ProgressRecord>,
    @InjectRepository(TrainerAssignment) private readonly assignments: Repository<TrainerAssignment>,
  ) {}

  // ---------------------------------------------------------------- Member
  async member(memberId: number) {
    const weekStart = daysFromToday(-6);
    const [totals, week, activity, categories, weights, recentWorkouts, activePlans, trainers, workoutDates] =
      await Promise.all([
        this.logTotals([memberId]),
        this.logTotals([memberId], weekStart),
        this.dailyActivity([memberId], 14),
        this.logs
          .createQueryBuilder('log')
          .innerJoin('log.exercise', 'exercise')
          .select('exercise.category', 'category')
          .addSelect('COUNT(*)', 'count')
          .where('log.memberId = :memberId', { memberId })
          .groupBy('exercise.category')
          .orderBy('count', 'DESC')
          .getRawMany<{ category: string; count: string }>(),
        this.progress.find({
          where: { memberId },
          order: { recordDate: 'DESC', progressId: 'DESC' },
          take: 12,
        }),
        this.logs.find({
          where: { memberId },
          relations: { exercise: true },
          order: { workoutDate: 'DESC', logId: 'DESC' },
          take: 5,
        }),
        this.plans.count({ where: { memberId } }),
        this.assignments.find({ where: { memberId }, relations: { trainer: true } }),
        this.logs
          .createQueryBuilder('log')
          .select('DISTINCT log.workoutDate', 'date')
          .where('log.memberId = :memberId', { memberId })
          .andWhere('log.workoutDate >= :from', { from: daysFromToday(-60) })
          .getRawMany<{ date: string }>(),
      ]);

    const weighed = weights.filter((r) => r.weightKg !== null).reverse();
    const latest = weighed.at(-1)?.weightKg ?? null;
    const first = weighed[0]?.weightKg ?? null;

    return {
      summary: {
        totalWorkouts: totals.workouts,
        totalMinutes: totals.minutes,
        workoutsThisWeek: week.workouts,
        minutesThisWeek: week.minutes,
        currentStreakDays: this.streak(new Set(workoutDates.map((d) => d.date))),
        activePlans,
        latestWeightKg: latest,
        weightChangeKg: latest !== null && first !== null ? Math.round((latest - first) * 100) / 100 : null,
      },
      activity,
      weightTrend: weighed.map((r) => ({ date: r.recordDate, weightKg: r.weightKg })),
      categoryBreakdown: categories.map((c) => ({ category: c.category, count: Number(c.count) })),
      recentWorkouts,
      trainers: trainers.map((a) => a.trainer),
    };
  }

  // --------------------------------------------------------------- Trainer
  async trainer(trainerId: number) {
    const assigned = await this.assignments.find({
      where: { trainerId },
      relations: { member: true },
      order: { assignedAt: 'DESC' },
    });
    const memberIds = assigned.map((a) => a.memberId);
    const weekStart = daysFromToday(-6);
    const monthStart = daysFromToday(-29);

    const [plansCreated, week, activity, recentWorkouts, perMember, latestWeights, planCounts] = await Promise.all([
      this.plans.count({ where: { trainerId } }),
      this.logTotals(memberIds, weekStart),
      this.dailyActivity(memberIds, 14),
      memberIds.length
        ? this.logs.find({
            where: { memberId: In(memberIds) },
            relations: { exercise: true, member: true },
            order: { workoutDate: 'DESC', logId: 'DESC' },
            take: 8,
          })
        : Promise.resolve([]),
      memberIds.length
        ? this.logs
            .createQueryBuilder('log')
            .select('log.memberId', 'memberId')
            .addSelect('MAX(log.workoutDate)', 'lastWorkoutDate')
            .addSelect('SUM(CASE WHEN log.workoutDate >= :monthStart THEN 1 ELSE 0 END)', 'workoutsLast30Days')
            .addSelect('SUM(CASE WHEN log.workoutDate >= :weekStart THEN 1 ELSE 0 END)', 'workoutsLast7Days')
            .where('log.memberId IN (:...memberIds)', { memberIds })
            .setParameters({ monthStart, weekStart })
            .groupBy('log.memberId')
            .getRawMany<{ memberId: number; lastWorkoutDate: string; workoutsLast30Days: string; workoutsLast7Days: string }>()
        : Promise.resolve([]),
      this.latestWeights(memberIds),
      memberIds.length
        ? this.plans
            .createQueryBuilder('plan')
            .select('plan.memberId', 'memberId')
            .addSelect('COUNT(*)', 'count')
            .where('plan.trainerId = :trainerId', { trainerId })
            .groupBy('plan.memberId')
            .getRawMany<{ memberId: number; count: string }>()
        : Promise.resolve([]),
    ]);

    const members = assigned.map((a) => {
      const stats = perMember.find((p) => Number(p.memberId) === a.memberId);
      return {
        assignmentId: a.assignmentId,
        assignedAt: a.assignedAt,
        member: a.member,
        lastWorkoutDate: stats?.lastWorkoutDate ?? null,
        workoutsLast7Days: Number(stats?.workoutsLast7Days ?? 0),
        workoutsLast30Days: Number(stats?.workoutsLast30Days ?? 0),
        latestWeightKg: latestWeights.get(a.memberId) ?? null,
        planCount: Number(planCounts.find((p) => Number(p.memberId) === a.memberId)?.count ?? 0),
      };
    });

    return {
      summary: {
        assignedMembers: memberIds.length,
        plansCreated,
        memberWorkoutsLast7Days: week.workouts,
        memberMinutesLast7Days: week.minutes,
        activeMembersLast7Days: members.filter((m) => m.workoutsLast7Days > 0).length,
      },
      members,
      activity,
      recentWorkouts,
    };
  }

  // ----------------------------------------------------------------- Admin
  async admin() {
    const [roleCounts, activeCount, exercises, plans, logs, progress, assignments, assignedMembers, registrations, activity, topExercises, categories, recentUsers] =
      await Promise.all([
        this.users
          .createQueryBuilder('u')
          .select('u.role', 'role')
          .addSelect('COUNT(*)', 'count')
          .groupBy('u.role')
          .getRawMany<{ role: Role; count: string }>(),
        this.users.count({ where: { isActive: true } }),
        this.exercises.count(),
        this.plans.count(),
        this.logs.count(),
        this.progress.count(),
        this.assignments.count(),
        this.assignments
          .createQueryBuilder('a')
          .select('COUNT(DISTINCT a.memberId)', 'count')
          .getRawOne<{ count: string }>(),
        this.users
          .createQueryBuilder('u')
          .select("DATE_FORMAT(u.createdAt, '%Y-%m')", 'month')
          .addSelect('COUNT(*)', 'count')
          .where('u.createdAt >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)')
          .groupBy('month')
          .orderBy('month', 'ASC')
          .getRawMany<{ month: string; count: string }>(),
        this.dailyActivity(null, 14),
        this.logs
          .createQueryBuilder('log')
          .innerJoin('log.exercise', 'exercise')
          .select('exercise.exerciseName', 'exerciseName')
          .addSelect('COUNT(*)', 'count')
          .groupBy('exercise.exerciseId')
          .addGroupBy('exercise.exerciseName')
          .orderBy('count', 'DESC')
          .limit(5)
          .getRawMany<{ exerciseName: string; count: string }>(),
        this.exercises
          .createQueryBuilder('e')
          .select('e.category', 'category')
          .addSelect('COUNT(*)', 'count')
          .groupBy('e.category')
          .orderBy('count', 'DESC')
          .getRawMany<{ category: string; count: string }>(),
        this.users.find({ order: { createdAt: 'DESC' }, take: 5 }),
      ]);

    const byRole = (role: Role) => Number(roleCounts.find((r) => r.role === role)?.count ?? 0);
    const totalUsers = roleCounts.reduce((sum, r) => sum + Number(r.count), 0);
    const memberCount = byRole(Role.Member);

    return {
      users: {
        total: totalUsers,
        members: memberCount,
        trainers: byRole(Role.Trainer),
        admins: byRole(Role.Admin),
        active: activeCount,
        inactive: totalUsers - activeCount,
      },
      totals: {
        exercises,
        workoutPlans: plans,
        workoutLogs: logs,
        progressRecords: progress,
        trainerAssignments: assignments,
        unassignedMembers: Math.max(0, memberCount - Number(assignedMembers?.count ?? 0)),
      },
      registrations: registrations.map((r) => ({ month: r.month, count: Number(r.count) })),
      activity,
      topExercises: topExercises.map((t) => ({ exerciseName: t.exerciseName, count: Number(t.count) })),
      exercisesByCategory: categories.map((c) => ({ category: c.category, count: Number(c.count) })),
      recentUsers,
    };
  }

  // --------------------------------------------------------------- helpers

  /** Workout count and total minutes for some members (null = everyone). */
  private async logTotals(memberIds: number[] | null, from?: string) {
    if (memberIds && memberIds.length === 0) return { workouts: 0, minutes: 0 };
    const qb = this.logs
      .createQueryBuilder('log')
      .select('COUNT(*)', 'workouts')
      .addSelect('COALESCE(SUM(log.durationMinutes), 0)', 'minutes');
    if (memberIds) qb.where('log.memberId IN (:...memberIds)', { memberIds });
    if (from) qb.andWhere('log.workoutDate >= :from', { from });
    const row = await qb.getRawOne<{ workouts: string; minutes: string }>();
    return { workouts: Number(row?.workouts ?? 0), minutes: Number(row?.minutes ?? 0) };
  }

  /** One entry per day for the last `days` days, including days with no workouts. */
  private async dailyActivity(memberIds: number[] | null, days: number): Promise<DailyActivity[]> {
    const dates = lastNDays(days);
    if (memberIds && memberIds.length === 0) return dates.map((date) => ({ date, workouts: 0, minutes: 0 }));
    const qb = this.logs
      .createQueryBuilder('log')
      .select('log.workoutDate', 'date')
      .addSelect('COUNT(*)', 'workouts')
      .addSelect('COALESCE(SUM(log.durationMinutes), 0)', 'minutes')
      .where('log.workoutDate >= :from', { from: dates[0] })
      .groupBy('log.workoutDate');
    if (memberIds) qb.andWhere('log.memberId IN (:...memberIds)', { memberIds });
    const rows = await qb.getRawMany<{ date: string; workouts: string; minutes: string }>();
    return dates.map((date) => {
      const row = rows.find((r) => r.date === date);
      return { date, workouts: Number(row?.workouts ?? 0), minutes: Number(row?.minutes ?? 0) };
    });
  }

  private async latestWeights(memberIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (memberIds.length === 0) return result;
    const records = await this.progress
      .createQueryBuilder('r')
      .where('r.memberId IN (:...memberIds)', { memberIds })
      .andWhere('r.weightKg IS NOT NULL')
      .orderBy('r.recordDate', 'DESC')
      .addOrderBy('r.progressId', 'DESC')
      .getMany();
    for (const record of records) {
      if (!result.has(record.memberId) && record.weightKg !== null) result.set(record.memberId, record.weightKg);
    }
    return result;
  }

  /** Consecutive days with at least one workout, ending today (or yesterday). */
  private streak(dates: Set<string>): number {
    let offset = dates.has(daysFromToday(0)) ? 0 : -1;
    let count = 0;
    while (dates.has(daysFromToday(offset))) {
      count++;
      offset--;
    }
    return count;
  }
}
