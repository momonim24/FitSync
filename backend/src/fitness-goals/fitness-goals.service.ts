import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Not, IsNull, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { daysFromToday, localDateOf } from '../common/utils/date.util';
import { badRequest, conflict, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { CreateFitnessGoalDto, FitnessGoalQueryDto, UpdateFitnessGoalDto } from './dto/fitness-goal.dto';
import { FitnessGoal } from './entities/fitness-goal.entity';
import { dayDiff, evaluateGoal, GOAL_STATUSES, GOAL_TYPES, type GoalProgress, type GoalType } from './goal-progress';

/**
 * Plausibility ranges (data validation, not advice). FitSync never suggests
 * a target; it only rejects values that cannot be real measurements.
 */
export const GOAL_LIMITS: Record<GoalType, { min: number; max: number; integer: boolean; label: string }> = {
  TargetWeight: { min: 20, max: 400, integer: false, label: 'Target weight must be between 20 and 400 kg.' },
  WeeklyWorkouts: { min: 1, max: 7, integer: true, label: 'Weekly workout days must be a whole number from 1 to 7.' },
  WeeklyMinutes: { min: 10, max: 2000, integer: true, label: 'Weekly minutes must be a whole number from 10 to 2000.' },
};
const MAX_GOAL_DAYS = 730;
const MAX_START_OFFSET_DAYS = 90;
const VIEW_DENIED = 'Not authorized to view these fitness goals.';
/** Stored statuses that evaluation may still change (see goal-progress.ts, QA fix M1). */
const SETTLEABLE = ['Active', 'Missed'];

export interface EvaluatedGoal {
  goal: FitnessGoal;
  progress: GoalProgress;
}

@Injectable()
export class FitnessGoalsService {
  constructor(
    @InjectRepository(FitnessGoal) private readonly goals: Repository<FitnessGoal>,
    @InjectRepository(ProgressRecord) private readonly progressRecords: Repository<ProgressRecord>,
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    private readonly assignments: TrainerAssignmentsService,
  ) {}

  // ================================================================ writes

  async create(dto: CreateFitnessGoalDto, actor: AuthUser) {
    const today = daysFromToday(0);
    const startDate = dto.startDate ?? today;
    if (dayDiff(today, startDate) > MAX_START_OFFSET_DAYS || dayDiff(startDate, today) > MAX_START_OFFSET_DAYS) {
      throw badRequest('Invalid goal dates.', `startDate must be within ${MAX_START_OFFSET_DAYS} days of today.`);
    }
    let startingValue: number | null = null;
    if (dto.goalType === 'TargetWeight') {
      if (dto.startingValue === undefined) this.validateTarget(dto.goalType, dto.targetValue);
      startingValue = dto.startingValue ?? (await this.latestWeightOnOrBefore(actor.userId, startDate));
      if (startingValue === null) {
        throw badRequest(
          'Starting weight required.',
          'Record your current weight on the Progress page first, or enter a starting weight for this goal.',
        );
      }
    } else if (dto.startingValue !== undefined) {
      throw badRequest('Invalid goal data.', 'startingValue is only used for TargetWeight goals.');
    }

    const definition = { goalType: dto.goalType, startingValue, targetValue: dto.targetValue, startDate, targetDate: dto.targetDate };
    this.validateDefinition(definition, today);
    // Settle statuses first: a goal that was just achieved or missed no longer blocks a new one.
    await this.evaluate(await this.goals.find({ where: { memberId: actor.userId, goalType: dto.goalType, status: 'Active' } }));
    if (await this.goals.exists({ where: { memberId: actor.userId, goalType: dto.goalType, status: 'Active' } })) {
      throw conflict('Active goal already exists.', `You already have an active ${dto.goalType} goal. Update or cancel it first.`);
    }
    const now = new Date(); // explicit UTC timestamps
    const saved = await this.goals.save(this.goals.create({ ...definition, memberId: actor.userId, goalName: dto.goalName, status: 'Active', createdAt: now, updatedAt: now }));
    return this.findOne(saved.goalId, actor);
  }

  /** Members update or cancel their own ACTIVE goals; type and start date are fixed. */
  async update(id: number, dto: UpdateFitnessGoalDto, actor: AuthUser) {
    const goal = await this.getById(id);
    if (goal.memberId !== actor.userId) throw forbidden('You can only change your own goals.');
    // Settle the stored status first (a goal may have just been achieved or missed).
    await this.evaluate([goal]);
    if (goal.status !== 'Active') {
      throw conflict('Goal is closed.', `This goal is ${goal.status} and can no longer be changed.`);
    }
    if (dto.status === 'Cancelled') {
      if (Object.keys(dto).some((k) => k !== 'status' && dto[k as keyof UpdateFitnessGoalDto] !== undefined)) {
        throw badRequest('Invalid goal data.', 'Cancel a goal without changing its other fields.');
      }
      const now = new Date();
      await this.goals.update({ goalId: id }, { status: 'Cancelled', closedAt: now, updatedAt: now });
      return this.findOne(id, actor);
    }
    if (dto.startingValue !== undefined && goal.goalType !== 'TargetWeight') {
      throw badRequest('Invalid goal data.', 'startingValue is only used for TargetWeight goals.');
    }
    const next = {
      goalType: goal.goalType,
      startingValue: dto.startingValue ?? goal.startingValue,
      targetValue: dto.targetValue ?? goal.targetValue,
      startDate: goal.startDate,
      targetDate: dto.targetDate ?? goal.targetDate,
    };
    this.validateDefinition(next, daysFromToday(0));
    await this.goals.update(
      { goalId: id },
      {
        ...(dto.goalName !== undefined && { goalName: dto.goalName }),
        startingValue: next.startingValue,
        targetValue: next.targetValue,
        targetDate: next.targetDate,
        updatedAt: new Date(),
      },
    );
    return this.findOne(id, actor);
  }

  // ================================================================ reads

  async findAll(query: FitnessGoalQueryDto, actor: AuthUser): Promise<Paginated<ReturnType<FitnessGoalsService['toView']>>> {
    const memberIds = await this.assignments.resolveMemberScope(actor, query.memberId, VIEW_DENIED);
    if (memberIds && memberIds.length === 0) return { items: [], total: 0, page: query.page, limit: query.limit };
    // Settle statuses before filtering by status so the filter is accurate.
    await this.evaluate(await this.goals.find({ where: { status: In(SETTLEABLE), ...(memberIds && { memberId: In(memberIds) }) } }));

    const [goals, total] = await this.goals.findAndCount({
      where: {
        ...(memberIds && { memberId: In(memberIds) }),
        ...(query.status && { status: query.status }),
        ...(query.goalType && { goalType: query.goalType }),
      },
      relations: { member: true },
      order: { status: 'ASC', targetDate: 'ASC', goalId: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const evaluated = await this.evaluate(goals);
    return { items: evaluated.map((e) => this.toView(e, false)), total, page: query.page, limit: query.limit };
  }

  async findOne(id: number, actor: AuthUser) {
    const goal = await this.getById(id);
    await this.assertCanView(goal, actor);
    const [evaluated] = await this.evaluate([goal]);
    return this.toView(evaluated, true);
  }

  /** Throws unless `actor` may see the goal (owner, assigned trainer). */
  async assertCanView(goal: FitnessGoal, actor: AuthUser): Promise<void> {
    if (actor.role === Role.Admin) throw forbidden('Administrators see aggregate goal statistics only.');
    await this.assignments.assertCanViewMember(actor, goal.memberId, 'Not authorized to view this fitness goal.');
  }

  /** Used by trainer feedback: the goal must exist and belong to `memberId`. */
  async getForMember(goalId: number, memberId: number): Promise<FitnessGoal> {
    const goal = await this.goals.findOne({ where: { goalId } });
    if (!goal) throw notFound('Fitness goal not found.', 'Goal ID does not exist.');
    if (goal.memberId !== memberId) throw badRequest('Invalid feedback data.', 'The goal does not belong to this member.');
    return goal;
  }

  /** Evaluated goals of some members (dashboards, reports). */
  async evaluatedForMembers(memberIds: number[] | null, statuses = [...GOAL_STATUSES]): Promise<EvaluatedGoal[]> {
    if (memberIds && memberIds.length === 0) return [];
    await this.evaluate(await this.goals.find({ where: { status: In(SETTLEABLE), ...(memberIds && { memberId: In(memberIds) }) } }));
    const goals = await this.goals.find({
      where: { status: In(statuses), ...(memberIds && { memberId: In(memberIds) }) },
      relations: { member: true },
      order: { targetDate: 'ASC', goalId: 'ASC' },
    });
    return this.evaluate(goals);
  }

  /**
   * Aggregate goal statistics without goal names or member identities
   * (admin dashboard and system report). memberIds null = everyone.
   */
  async statistics(memberIds: number[] | null) {
    const all = await this.evaluatedForMembers(memberIds);
    const count = (pred: (e: EvaluatedGoal) => boolean) => all.filter(pred).length;
    const active = all.filter((e) => e.goal.status === 'Active');
    const completed = count((e) => e.goal.status === 'Completed');
    const missed = count((e) => e.goal.status === 'Missed');
    const progressValues = active.map((e) => e.progress.progressPercent).filter((p): p is number => p !== null);
    return {
      total: all.length,
      byStatus: Object.fromEntries(GOAL_STATUSES.map((s) => [s, count((e) => e.goal.status === s)])) as Record<(typeof GOAL_STATUSES)[number], number>,
      byType: GOAL_TYPES.map((goalType) => ({
        goalType,
        total: count((e) => e.goal.goalType === goalType),
        active: count((e) => e.goal.goalType === goalType && e.goal.status === 'Active'),
        completed: count((e) => e.goal.goalType === goalType && e.goal.status === 'Completed'),
      })),
      activeByState: {
        onTrack: count((e) => e.goal.status === 'Active' && ['OnTrack', 'InProgress'].includes(e.progress.state)),
        behind: count((e) => e.goal.status === 'Active' && e.progress.state === 'Behind'),
        noData: count((e) => e.goal.status === 'Active' && e.progress.state === 'NoData'),
        upcoming: count((e) => e.goal.status === 'Active' && e.progress.state === 'Upcoming'),
      },
      achievementRatePercent: completed + missed ? Math.round((completed / (completed + missed)) * 1000) / 10 : null,
      averageActiveProgressPercent: progressValues.length ? Math.round((progressValues.reduce((s, v) => s + v, 0) / progressValues.length) * 10) / 10 : null,
      membersWithActiveGoals: new Set(active.map((e) => e.goal.memberId)).size,
    };
  }

  // ================================================================ helpers

  /**
   * Calculates progress for goals and settles their stored status: an
   * Active goal whose target was reached becomes Completed, one whose
   * target date passed becomes Missed (ClosedAt = now). Idempotent.
   */
  async evaluate(goals: FitnessGoal[]): Promise<EvaluatedGoal[]> {
    if (goals.length === 0) return [];
    const today = daysFromToday(0);
    const memberIds = [...new Set(goals.map((g) => g.memberId))];
    const from = goals.reduce((min, g) => (g.startDate < min ? g.startDate : min), goals[0].startDate);
    const needsWeights = goals.some((g) => g.goalType === 'TargetWeight');
    const needsLogs = goals.some((g) => g.goalType !== 'TargetWeight');

    const [weights, logs] = await Promise.all([
      needsWeights && from <= today
        ? this.progressRecords.find({
            where: { memberId: In(memberIds), recordDate: Between(from, today), weightKg: Not(IsNull()) },
            select: { memberId: true, recordDate: true, weightKg: true, progressId: true },
            order: { recordDate: 'ASC', progressId: 'ASC' },
          })
        : Promise.resolve([] as ProgressRecord[]),
      needsLogs && from <= today
        ? this.logs.find({
            where: { memberId: In(memberIds), workoutDate: Between(from, today) },
            select: { memberId: true, workoutDate: true, durationMinutes: true, logId: true },
          })
        : Promise.resolve([] as WorkoutLog[]),
    ]);

    const results: EvaluatedGoal[] = [];
    for (const goal of goals) {
      let progress = evaluateGoal({ ...goal, closedOn: goal.closedAt ? localDateOf(goal.closedAt) : null }, today, {
        weights: weights.filter((w) => w.memberId === goal.memberId).map((w) => ({ date: w.recordDate, weightKg: w.weightKg as number })),
        workouts: logs.filter((l) => l.memberId === goal.memberId).map((l) => ({ date: l.workoutDate, durationMinutes: l.durationMinutes })),
      });
      // Active -> Completed/Missed, or Missed -> Completed when late-logged records inside the
      // goal period reach the target. Completed and Cancelled are never changed here.
      if ((goal.status === 'Active' || goal.status === 'Missed') && progress.closeAs) {
        const previous = goal.status;
        goal.status = progress.closeAs;
        goal.closedAt = new Date();
        await this.goals.update({ goalId: goal.goalId, status: previous }, { status: goal.status, closedAt: goal.closedAt, updatedAt: goal.closedAt });
        progress = { ...progress, closeAs: null, evidenceChanged: false };
      }
      results.push({ goal, progress });
    }
    return results;
  }

  toView({ goal, progress: evaluated }: EvaluatedGoal, withWeeks: boolean) {
    // closeAs is internal (used to settle the stored status) and is not part of the API.
    const { closeAs: _closeAs, ...progress } = evaluated;
    void _closeAs;
    return {
      goalId: goal.goalId,
      memberId: goal.memberId,
      member: goal.member ? { userId: goal.member.userId, fullName: goal.member.fullName } : undefined,
      goalType: goal.goalType,
      goalName: goal.goalName,
      startingValue: goal.startingValue,
      targetValue: goal.targetValue,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      status: goal.status,
      closedAt: goal.closedAt,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      progress: withWeeks || !progress.weekly ? progress : { ...progress, weekly: { ...progress.weekly, weeks: undefined } },
    };
  }

  private async getById(id: number): Promise<FitnessGoal> {
    const goal = await this.goals.findOne({ where: { goalId: id }, relations: { member: true } });
    if (!goal) throw notFound('Fitness goal not found.', 'Goal ID does not exist.');
    return goal;
  }

  private async latestWeightOnOrBefore(memberId: number, date: string): Promise<number | null> {
    const record = await this.progressRecords.findOne({
      where: { memberId, recordDate: LessThanOrEqual(date), weightKg: Not(IsNull()) },
      order: { recordDate: 'DESC', progressId: 'DESC' },
    });
    return record?.weightKg ?? null;
  }

  private validateTarget(goalType: GoalType, targetValue: number): void {
    const limits = GOAL_LIMITS[goalType];
    if (targetValue < limits.min || targetValue > limits.max || (limits.integer && !Number.isInteger(targetValue))) {
      throw badRequest('Invalid goal data.', limits.label);
    }
  }

  /** Type ranges, starting weight, dates and whole goal weeks. */
  private validateDefinition(
    g: { goalType: GoalType; startingValue: number | null; targetValue: number; startDate: string; targetDate: string },
    today: string,
  ): void {
    const limits = GOAL_LIMITS[g.goalType];
    this.validateTarget(g.goalType, g.targetValue);
    if (g.goalType === 'TargetWeight') {
      const start = g.startingValue!;
      if (start < limits.min || start > limits.max) throw badRequest('Invalid goal data.', 'Starting weight must be between 20 and 400 kg.');
      if (start === g.targetValue) throw badRequest('Invalid goal data.', 'Target weight must be different from the starting weight.');
    }
    if (g.targetDate <= g.startDate) throw badRequest('Invalid goal dates.', 'targetDate must be after startDate.');
    if (g.targetDate < today) throw badRequest('Invalid goal dates.', 'targetDate cannot be in the past.');
    const days = dayDiff(g.startDate, g.targetDate) + 1;
    if (days > MAX_GOAL_DAYS) throw badRequest('Invalid goal dates.', `A goal can cover at most ${MAX_GOAL_DAYS} days.`);
    if (g.goalType !== 'TargetWeight' && days % 7 !== 0) {
      throw badRequest(
        'Invalid goal dates.',
        `Weekly goals run in whole 7-day goal weeks, so the goal must last 7, 14, 21, … days counting both dates (for example ${g.startDate} to ${addWeeksLabel(g.startDate)}).`,
      );
    }
  }
}

/** Example end date for a 4-week goal, used in the validation message. */
function addWeeksLabel(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + 27 * 86_400_000).toISOString().slice(0, 10) + ' for 4 weeks';
}
