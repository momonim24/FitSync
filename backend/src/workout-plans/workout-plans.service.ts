import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { conflict, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { User } from '../users/entities/user.entity';
import { CreateWorkoutPlanDto, WorkoutPlanQueryDto } from './dto/workout-plan.dto';
import { WorkoutPlan } from './entities/workout-plan.entity';

@Injectable()
export class WorkoutPlansService {
  constructor(
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly assignments: TrainerAssignmentsService,
  ) {}

  /** Lab 05 #7 — a trainer creates a plan for one of their assigned members. */
  async create(dto: CreateWorkoutPlanDto, actor: AuthUser): Promise<WorkoutPlan> {
    await this.assertTrainerMayPlanFor(actor, dto);
    const saved = await this.plans.save(
      this.plans.create({ trainerId: actor.userId, memberId: dto.memberId, planName: dto.planName }),
    );
    return this.getById(saved.planId);
  }

  /** Member: own plans. Trainer: plans they created. Admin: all. */
  async findAll(query: WorkoutPlanQueryDto, actor: AuthUser): Promise<Paginated<WorkoutPlan>> {
    const qb = this.plans
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.trainer', 'trainer')
      .leftJoinAndSelect('plan.member', 'member')
      .leftJoinAndSelect('plan.planExercises', 'pe')
      .leftJoinAndSelect('pe.exercise', 'exercise')
      .orderBy('plan.createdAt', 'DESC')
      .addOrderBy('pe.planExerciseId', 'ASC');

    if (actor.role === Role.Member) qb.andWhere('plan.memberId = :self', { self: actor.userId });
    if (actor.role === Role.Trainer) {
      // Plans this trainer created for members they are CURRENTLY assigned to (QA fix L5).
      const assigned = await this.assignments.assignedMemberIds(actor.userId);
      if (assigned.length === 0) return { items: [], total: 0, page: query.page, limit: query.limit };
      qb.andWhere('plan.trainerId = :self', { self: actor.userId }).andWhere('plan.memberId IN (:...assigned)', { assigned });
    }
    if (query.memberId) qb.andWhere('plan.memberId = :memberId', { memberId: query.memberId });
    if (query.trainerId) qb.andWhere('plan.trainerId = :trainerId', { trainerId: query.trainerId });

    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number, actor: AuthUser): Promise<WorkoutPlan> {
    const plan = await this.getById(id);
    await this.assertCanView(plan, actor);
    return plan;
  }

  async findPlanExercises(id: number, actor: AuthUser): Promise<PlanExercise[]> {
    const plan = await this.findOne(id, actor);
    return plan.planExercises ?? [];
  }

  /**
   * Lab 05 #8 — Replace workout plan (Trainer who owns it).
   * A plan may be moved to another member only while no workout has been
   * counted toward it: completion history belongs to the member who did the
   * workouts and is never transferred (QA fix H1). Renaming is always allowed.
   */
  async replace(id: number, dto: CreateWorkoutPlanDto, actor: AuthUser): Promise<WorkoutPlan> {
    const plan = await this.getById(id);
    await this.assertCanManage(plan, actor);
    await this.assertTrainerMayPlanFor(actor, dto);
    if (dto.memberId !== plan.memberId && (await this.hasCompletionHistory(id))) {
      throw conflict(
        'Plan member cannot change.',
        'Workouts have already been counted toward this plan. Create a new plan for the other member instead; the completion history stays with the member who did the workouts.',
      );
    }
    await this.plans.update({ planId: id }, { memberId: dto.memberId, planName: dto.planName });
    return this.getById(id);
  }

  /** True when at least one workout completion is linked to the plan. */
  async hasCompletionHistory(planId: number): Promise<boolean> {
    const [row] = await this.plans.query('SELECT 1 AS found FROM WorkoutCompletions WHERE PlanID = ? LIMIT 1', [planId]);
    return Boolean(row);
  }

  /** Deletes the plan; its PlanExercises rows are removed by ON DELETE CASCADE. */
  async remove(id: number, actor: AuthUser): Promise<void> {
    const plan = await this.getById(id);
    if (actor.role !== Role.Admin) await this.assertCanManage(plan, actor);
    await this.plans.delete({ planId: id });
  }

  // ---------------------------------------------------------------------
  // Helpers shared with PlanExercisesService
  // ---------------------------------------------------------------------

  async getById(id: number): Promise<WorkoutPlan> {
    const plan = await this.plans
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.trainer', 'trainer')
      .leftJoinAndSelect('plan.member', 'member')
      .leftJoinAndSelect('plan.planExercises', 'pe')
      .leftJoinAndSelect('pe.exercise', 'exercise')
      .where('plan.planId = :id', { id })
      .orderBy('pe.planExerciseId', 'ASC')
      .getOne();
    if (!plan) throw notFound('Workout plan not found.', 'Plan ID does not exist.');
    return plan;
  }

  /**
   * Member: own plans. Trainer: plans they created, while still assigned to
   * the member (QA fix L5 — a former trainer no longer sees the member's
   * plan contents or completion data). Admin: all.
   */
  async assertCanView(plan: WorkoutPlan, actor: AuthUser): Promise<void> {
    if (actor.role === Role.Admin) return;
    if (actor.role === Role.Member && plan.memberId === actor.userId) return;
    if (actor.role === Role.Trainer && plan.trainerId === actor.userId && (await this.assignments.isAssigned(actor.userId, plan.memberId))) return;
    throw forbidden('Not authorized to view this workout plan.');
  }

  /** Only the trainer who created the plan, while still assigned to the member. */
  async assertCanManage(plan: WorkoutPlan, actor: AuthUser): Promise<void> {
    const ownsPlan = actor.role === Role.Trainer && plan.trainerId === actor.userId;
    if (!ownsPlan || !(await this.assignments.isAssigned(actor.userId, plan.memberId))) {
      throw forbidden('Only the assigned trainer who created this plan can modify it.');
    }
  }

  private async assertTrainerMayPlanFor(actor: AuthUser, dto: CreateWorkoutPlanDto): Promise<void> {
    if (dto.trainerId !== undefined && dto.trainerId !== actor.userId) {
      throw forbidden('Trainers can only create plans under their own trainer ID.');
    }
    const member = await this.users.findOne({ where: { userId: dto.memberId } });
    if (!member || member.role !== Role.Member) {
      throw notFound('Member not found.', 'Member ID does not exist.');
    }
    if (!(await this.assignments.isAssigned(actor.userId, dto.memberId))) {
      throw forbidden('Only assigned trainers can create plans.');
    }
  }
}
