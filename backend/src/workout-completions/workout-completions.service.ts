import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { badRequest, conflict, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { localDateOf } from '../common/utils/date.util';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { ReportRange, resolveRange } from '../reports/report-range';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { WorkoutPlansService } from '../workout-plans/workout-plans.service';
import {
  averagePercent,
  combinedCompletionPercent,
  combinedCompletionRatio,
  completionScore,
  type LinkedAttempt,
  type PlanSummary,
  statusForScore,
  summarizePlan,
} from './completion-calculator';
import { AdherenceQueryDto, CompletionPeriodQueryDto, CreateWorkoutCompletionDto, WorkoutCompletionQueryDto } from './dto/workout-completion.dto';
import { WorkoutCompletion } from './entities/workout-completion.entity';

const VIEW_DENIED = 'Not authorized to view these workout completions.';
const userSummary = (u?: User | null) => (u ? { userId: u.userId, fullName: u.fullName, email: u.email } : null);

/** Data kept for each linked log when summarising a plan. */
export interface AttemptData {
  completionId: number;
  logId: number;
  workoutDate: string;
  sets: number;
  repetitions: number;
  durationMinutes: number;
  prescribedSets: number;
  prescribedReps: number;
  prescribedDurationMinutes: number | null;
}

export interface PlanCompletionResult {
  plan: WorkoutPlan;
  summary: PlanSummary<AttemptData>;
}

/**
 * Unrounded completion ratio (0..1) of each adherence row. Kept outside the
 * row object so the JSON response is unchanged; used for averages so they are
 * never computed from already-rounded percentages (QA fix L2).
 */
const completionRatios = new WeakMap<object, number | null>();
export const ratioOf = (row: object): number | null => completionRatios.get(row) ?? null;

/** The day a plan starts counting workouts: its creation day in the app time zone. */
export const planStartDate = (plan: Pick<WorkoutPlan, 'createdAt'>) => localDateOf(plan.createdAt);

/** Default period for completion summaries is the last 7 days. */
export function resolveCompletionRange(query: CompletionPeriodQueryDto): ReportRange {
  return resolveRange({ ...query, period: query.period ?? (query.from || query.to ? 'custom' : 'week') });
}

@Injectable()
export class WorkoutCompletionsService {
  constructor(
    @InjectRepository(WorkoutCompletion) private readonly completions: Repository<WorkoutCompletion>,
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    @InjectRepository(PlanExercise) private readonly planExercises: Repository<PlanExercise>,
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly assignments: TrainerAssignmentsService,
    private readonly plansService: WorkoutPlansService,
  ) {}

  // ================================================================ linking

  /**
   * Validates that a workout (by its exercise and date) may count toward a
   * plan exercise for `actor`. Used before a log is created from a plan and
   * when an existing log is linked.
   */
  async loadLinkTarget(planExerciseId: number, exerciseId: number, workoutDate: string, actor: AuthUser): Promise<PlanExercise> {
    const planExercise = await this.planExercises.findOne({ where: { planExerciseId }, relations: { plan: true, exercise: true } });
    if (!planExercise) throw notFound('Plan exercise not found.', 'Plan exercise ID does not exist.');
    if (planExercise.plan!.memberId !== actor.userId) {
      throw forbidden('This workout plan is not assigned to you.');
    }
    if (planExercise.exerciseId !== exerciseId) {
      throw badRequest(
        'Workout does not match the prescription.',
        `This plan item prescribes ${planExercise.exercise?.exerciseName ?? 'a different exercise'}; a workout for another exercise cannot complete it.`,
      );
    }
    if (workoutDate < planStartDate(planExercise.plan!)) {
      throw badRequest('Workout predates the plan.', 'Workouts recorded before the plan was created cannot count toward it.');
    }
    return planExercise;
  }

  /** Builds (does not save) the link row, copying the current prescription. */
  buildLink(logId: number, planExercise: PlanExercise): WorkoutCompletion {
    return this.completions.create({
      createdAt: new Date(), // explicit UTC timestamp
      logId,
      planExerciseId: planExercise.planExerciseId,
      planId: planExercise.planId,
      planName: planExercise.plan!.planName,
      prescribedSets: planExercise.targetSets,
      prescribedReps: planExercise.targetReps,
      prescribedDurationMinutes: planExercise.targetDurationMinutes ?? null,
    });
  }

  /** Saves a link inside an existing transaction (used by POST /workout-logs). */
  async saveLink(manager: EntityManager, link: WorkoutCompletion): Promise<WorkoutCompletion> {
    return manager.getRepository(WorkoutCompletion).save(link);
  }

  /** POST /workout-completions — count one of the member's own workouts toward their plan. */
  async create(dto: CreateWorkoutCompletionDto, actor: AuthUser) {
    const log = await this.logs.findOne({ where: { logId: dto.logId } });
    if (!log) throw notFound('Workout log not found.', 'Log ID does not exist.');
    if (log.memberId !== actor.userId) throw forbidden('You can only count your own workouts.');
    if (await this.completions.exists({ where: { logId: log.logId } })) {
      throw conflict('Workout already counted.', 'This workout is already counted toward a workout plan.');
    }
    const planExercise = await this.loadLinkTarget(dto.planExerciseId, log.exerciseId, log.workoutDate, actor);
    try {
      const saved = await this.completions.save(this.buildLink(log.logId, planExercise));
      return this.toView(await this.getById(saved.completionId));
    } catch (error) {
      // Two concurrent requests for the same log: the UNIQUE(LogID) constraint wins.
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw conflict('Workout already counted.', 'This workout is already counted toward a workout plan.');
      }
      throw error;
    }
  }

  /** DELETE /workout-completions/:id — the member stops counting a workout (the log itself stays). */
  async remove(id: number, actor: AuthUser): Promise<void> {
    const completion = await this.getById(id);
    if (completion.log!.memberId !== actor.userId) throw forbidden('You can only change your own workout completions.');
    await this.completions.delete({ completionId: id });
  }

  /**
   * Called after a workout log is edited. The completion score is always
   * recalculated from the log, but if the log no longer matches the
   * prescription (different exercise, or dated before the plan) the link is
   * removed so an unrelated workout never counts. Returns true if unlinked.
   */
  async reconcileAfterLogUpdate(log: WorkoutLog): Promise<boolean> {
    const completion = await this.completions.findOne({ where: { logId: log.logId }, relations: { planExercise: true, plan: true } });
    if (!completion) return false;
    const exerciseChanged = completion.planExercise ? completion.planExercise.exerciseId !== log.exerciseId : false;
    const beforePlan = completion.plan ? log.workoutDate < planStartDate(completion.plan) : false;
    if (!exerciseChanged && !beforePlan) return false;
    await this.completions.delete({ completionId: completion.completionId });
    return true;
  }

  /** The completion linked to a log, if any (for the POST /workout-logs response). */
  async findByLog(logId: number) {
    const completion = await this.completions.findOne({ where: { logId }, relations: { log: { exercise: true } } });
    return completion ? this.toView(completion) : null;
  }

  // ================================================================ reading

  /** GET /workout-completions — completion history, scoped like workout logs. */
  async findAll(query: WorkoutCompletionQueryDto, actor: AuthUser): Promise<Paginated<ReturnType<WorkoutCompletionsService['toView']>>> {
    const memberIds = await this.assignments.resolveMemberScope(actor, query.memberId, VIEW_DENIED);
    const qb = this.completions
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.log', 'log')
      .leftJoinAndSelect('log.exercise', 'exercise')
      .orderBy('log.workoutDate', 'DESC')
      .addOrderBy('c.completionId', 'DESC');
    if (memberIds !== null) {
      if (memberIds.length === 0) return { items: [], total: 0, page: query.page, limit: query.limit };
      qb.andWhere('log.memberId IN (:...memberIds)', { memberIds });
    }
    if (query.planId) qb.andWhere('c.planId = :planId', { planId: query.planId });
    if (query.from) qb.andWhere('log.workoutDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.workoutDate <= :to', { to: query.to });
    const [rows, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items: rows.map((c) => this.toView(c)), total, page: query.page, limit: query.limit };
  }

  /** GET /workout-plans/:id/completion — prescribed vs actual for one plan in a period. */
  async planCompletion(planId: number, query: CompletionPeriodQueryDto, actor: AuthUser) {
    const plan = await this.plansService.getById(planId);
    await this.plansService.assertCanView(plan, actor);
    const range = resolveCompletionRange(query);
    const [result] = await this.summarizePlans([plan], range);
    const byId = new Map(result.summary.exercises.map((e) => [e.planExerciseId, e]));
    return {
      plan: {
        planId: plan.planId,
        planName: plan.planName,
        createdAt: plan.createdAt,
        countsFrom: planStartDate(plan),
        member: userSummary(plan.member),
        trainer: userSummary(plan.trainer),
      },
      range: { period: range.period, from: range.from, to: range.to, days: range.days },
      summary: {
        prescribedExercises: result.summary.prescribedExercises,
        completedExercises: result.summary.completedExercises,
        partialExercises: result.summary.partialExercises,
        pendingExercises: result.summary.pendingExercises,
        completionPercent: result.summary.completionPercent,
        linkedWorkouts: result.summary.exercises.reduce((s, e) => s + e.attempts, 0),
      },
      exercises: (plan.planExercises ?? []).map((pe) => {
        const e = byId.get(pe.planExerciseId)!;
        const best = e.best?.data ?? null;
        return {
          planExerciseId: pe.planExerciseId,
          exercise: pe.exercise ? { exerciseId: pe.exercise.exerciseId, exerciseName: pe.exercise.exerciseName, category: pe.exercise.category } : null,
          prescribed: { sets: pe.targetSets, reps: pe.targetReps, durationMinutes: pe.targetDurationMinutes ?? null },
          status: e.status,
          scorePercent: Math.round(e.score * 1000) / 10,
          attempts: e.attempts,
          lastWorkoutDate: e.latest?.workoutDate ?? null,
          best: best && {
            completionId: best.completionId,
            logId: best.logId,
            workoutDate: best.workoutDate,
            actual: { sets: best.sets, repetitions: best.repetitions, durationMinutes: best.durationMinutes },
            prescribedAtTheTime: { sets: best.prescribedSets, reps: best.prescribedReps, durationMinutes: best.prescribedDurationMinutes },
          },
        };
      }),
    };
  }

  /**
   * GET /workout-completions/adherence — one row per member.
   * Trainer: currently assigned members, plans this trainer created.
   * Member: themselves, all their plans. Admin: every member with a plan.
   */
  async adherence(query: AdherenceQueryDto, actor: AuthUser) {
    const range = resolveCompletionRange(query);
    const memberIds = await this.assignments.resolveMemberScope(actor, query.memberId, VIEW_DENIED);
    const rows = await this.adherenceRows(memberIds, actor.role === Role.Trainer ? actor.userId : null, range);
    const withPlans = rows.filter((r) => r.completionPercent !== null);
    return {
      range: { period: range.period, from: range.from, to: range.to, days: range.days },
      summary: {
        members: rows.length,
        membersWithPlans: withPlans.length,
        averageCompletionPercent: averagePercent(rows.map(ratioOf)),
      },
      members: rows,
    };
  }

  /**
   * Adherence rows shared by the adherence endpoint, the dashboards and the
   * reports. memberIds null = every member that has a plan (admin).
   * trainerId limits plans to those created by that trainer.
   */
  async adherenceRows(memberIds: number[] | null, trainerId: number | null, range: ReportRange) {
    if (memberIds && memberIds.length === 0) return [];
    const planQuery = this.plans
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.planExercises', 'pe')
      .leftJoinAndSelect('plan.trainer', 'trainer')
      .orderBy('plan.createdAt', 'ASC')
      .addOrderBy('pe.planExerciseId', 'ASC');
    if (memberIds) planQuery.andWhere('plan.memberId IN (:...memberIds)', { memberIds });
    if (trainerId !== null) planQuery.andWhere('plan.trainerId = :trainerId', { trainerId });
    const plans = await planQuery.getMany();

    const ids = memberIds ?? [...new Set(plans.map((p) => p.memberId))];
    if (ids.length === 0) return [];
    const [members, summaries, workoutCounts, lastWorkouts] = await Promise.all([
      this.users.find({ where: { userId: In(ids) }, order: { fullName: 'ASC' } }),
      this.summarizePlans(plans, range),
      this.logs
        .createQueryBuilder('log')
        .leftJoin(WorkoutCompletion, 'c', 'c.logId = log.logId')
        .select('log.memberId', 'memberId')
        .addSelect('COUNT(*)', 'workouts')
        .addSelect('COUNT(c.completionId)', 'linked')
        .addSelect('MAX(log.workoutDate)', 'lastWorkoutDate')
        .where('log.memberId IN (:...ids)', { ids })
        .andWhere('log.workoutDate BETWEEN :from AND :to', range)
        .groupBy('log.memberId')
        .getRawMany<{ memberId: number; workouts: string; linked: string; lastWorkoutDate: string }>(),
      // Most recent workout EVER (not limited to the period), so "never logged"
      // and "inactive recently" can be told apart (QA fix L3).
      this.logs
        .createQueryBuilder('log')
        .select('log.memberId', 'memberId')
        .addSelect('MAX(log.workoutDate)', 'lastWorkoutDate')
        .where('log.memberId IN (:...ids)', { ids })
        .groupBy('log.memberId')
        .getRawMany<{ memberId: number; lastWorkoutDate: string }>(),
    ]);

    return members.map((member) => {
      const own = summaries.filter((s) => s.plan.memberId === member.userId);
      const counts = workoutCounts.find((w) => Number(w.memberId) === member.userId);
      const workouts = Number(counts?.workouts ?? 0);
      const linked = Number(counts?.linked ?? 0);
      const row = {
        member: userSummary(member)!,
        plans: own.map(({ plan, summary }) => ({
          planId: plan.planId,
          planName: plan.planName,
          trainer: userSummary(plan.trainer),
          prescribedExercises: summary.prescribedExercises,
          completedExercises: summary.completedExercises,
          partialExercises: summary.partialExercises,
          pendingExercises: summary.pendingExercises,
          completionPercent: summary.completionPercent,
        })),
        prescribedExercises: own.reduce((s, p) => s + p.summary.prescribedExercises, 0),
        completedExercises: own.reduce((s, p) => s + p.summary.completedExercises, 0),
        partialExercises: own.reduce((s, p) => s + p.summary.partialExercises, 0),
        pendingExercises: own.reduce((s, p) => s + p.summary.pendingExercises, 0),
        completionPercent: combinedCompletionPercent(own.map((p) => p.summary)),
        workoutsInPeriod: workouts,
        planWorkouts: linked,
        otherWorkouts: workouts - linked,
        lastWorkoutDate: lastWorkouts.find((w) => Number(w.memberId) === member.userId)?.lastWorkoutDate ?? null,
      };
      completionRatios.set(row, combinedCompletionRatio(own.map((p) => p.summary)));
      return row;
    });
  }

  /** Completion summary of each plan for a period (plans must include planExercises). */
  async summarizePlans(plans: WorkoutPlan[], range: Pick<ReportRange, 'from' | 'to'>): Promise<PlanCompletionResult[]> {
    if (plans.length === 0) return [];
    const links = await this.completions
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.log', 'log')
      .where('c.planId IN (:...planIds)', { planIds: plans.map((p) => p.planId) })
      .andWhere('c.planExerciseId IS NOT NULL')
      .andWhere('log.workoutDate BETWEEN :from AND :to', { from: range.from, to: range.to })
      .getMany();
    return plans.map((plan) => {
      // Only the plan's CURRENT member's own workouts count (QA fix H1): a
      // completion linked by another member never counts or is shown here.
      const attempts: LinkedAttempt<AttemptData>[] = links
        .filter((c) => c.planId === plan.planId && c.log!.memberId === plan.memberId)
        .map((c) => ({
          planExerciseId: c.planExerciseId!,
          workoutDate: c.log!.workoutDate,
          score: completionScore(c.log!, { sets: c.prescribedSets, reps: c.prescribedReps, durationMinutes: c.prescribedDurationMinutes }),
          data: {
            completionId: c.completionId,
            logId: c.logId,
            workoutDate: c.log!.workoutDate,
            sets: c.log!.sets,
            repetitions: c.log!.repetitions,
            durationMinutes: c.log!.durationMinutes,
            prescribedSets: c.prescribedSets,
            prescribedReps: c.prescribedReps,
            prescribedDurationMinutes: c.prescribedDurationMinutes,
          },
        }));
      return { plan, summary: summarizePlan((plan.planExercises ?? []).map((pe) => pe.planExerciseId), attempts) };
    });
  }

  // ================================================================ helpers

  private async getById(id: number): Promise<WorkoutCompletion> {
    const completion = await this.completions.findOne({ where: { completionId: id }, relations: { log: { exercise: true } } });
    if (!completion) throw notFound('Workout completion not found.', 'Completion ID does not exist.');
    return completion;
  }

  /** API shape of one completion (history row). */
  toView(c: WorkoutCompletion) {
    const log = c.log!;
    const score = completionScore(log, { sets: c.prescribedSets, reps: c.prescribedReps, durationMinutes: c.prescribedDurationMinutes });
    return {
      completionId: c.completionId,
      logId: c.logId,
      memberId: log.memberId,
      planId: c.planId,
      planName: c.planName,
      planExerciseId: c.planExerciseId,
      planExerciseRemoved: c.planExerciseId === null,
      workoutDate: log.workoutDate,
      exercise: log.exercise ? { exerciseId: log.exercise.exerciseId, exerciseName: log.exercise.exerciseName, category: log.exercise.category } : null,
      prescribed: { sets: c.prescribedSets, reps: c.prescribedReps, durationMinutes: c.prescribedDurationMinutes },
      actual: { sets: log.sets, repetitions: log.repetitions, durationMinutes: log.durationMinutes },
      scorePercent: Math.round(score * 1000) / 10,
      status: statusForScore(score),
      createdAt: c.createdAt,
    };
  }
}
