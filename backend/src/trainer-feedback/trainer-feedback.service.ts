import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, IsNull, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { badRequest, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { FitnessGoalsService } from '../fitness-goals/fitness-goals.service';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { User } from '../users/entities/user.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { CreateTrainerFeedbackDto, TrainerFeedbackQueryDto, UpdateTrainerFeedbackDto } from './dto/trainer-feedback.dto';
import { FEEDBACK_TYPES, TrainerFeedback } from './entities/trainer-feedback.entity';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH, normalizeFeedbackMessage } from './feedback-text';

/*
 * ACCESS RULES
 *   Trainer  writes feedback only for CURRENTLY assigned members; edits and
 *            deletes only feedback they wrote, while still assigned.
 *            Reads: feedback they wrote (kept after reassignment) plus any
 *            feedback for members currently assigned to them (continuity
 *            when a member changes trainer).
 *   Member   reads only feedback addressed to them and marks it as read.
 *   Admin    no access to messages; aggregate counts only (dashboard/report).
 */
@Injectable()
export class TrainerFeedbackService {
  constructor(
    @InjectRepository(TrainerFeedback) private readonly feedback: Repository<TrainerFeedback>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    private readonly assignments: TrainerAssignmentsService,
    private readonly goals: FitnessGoalsService,
  ) {}

  async create(dto: CreateTrainerFeedbackDto, actor: AuthUser) {
    const member = await this.users.findOne({ where: { userId: dto.memberId } });
    if (!member || member.role !== Role.Member) throw notFound('Member not found.', 'Member ID does not exist.');
    if (!(await this.assignments.isAssigned(actor.userId, dto.memberId))) {
      throw forbidden('Only the assigned trainer can give feedback to this member.');
    }
    const message = this.cleanMessage(dto.feedbackMessage);
    await this.validateRelations(dto.memberId, dto.relatedGoalId ?? null, dto.relatedPlanId ?? null, actor);
    const now = new Date(); // explicit UTC timestamps (see DESIGN_DECISIONS: timestamps)
    const saved = await this.feedback.save(
      this.feedback.create({
        createdAt: now,
        updatedAt: now,
        trainerId: actor.userId,
        memberId: dto.memberId,
        feedbackType: dto.feedbackType ?? 'General',
        feedbackMessage: message,
        relatedGoalId: dto.relatedGoalId ?? null,
        relatedPlanId: dto.relatedPlanId ?? null,
        readAt: null,
      }),
    );
    return this.toView(await this.getById(saved.feedbackId));
  }

  async findAll(query: TrainerFeedbackQueryDto, actor: AuthUser): Promise<Paginated<ReturnType<TrainerFeedbackService['toView']>> & { unread: number | null }> {
    const qb = this.baseQuery().orderBy('f.createdAt', 'DESC').addOrderBy('f.feedbackId', 'DESC');

    if (actor.role === Role.Member) {
      if (query.memberId && query.memberId !== actor.userId) throw forbidden('Not authorized to view this feedback.');
      qb.andWhere('f.memberId = :self', { self: actor.userId });
    } else if (actor.role === Role.Trainer) {
      const assigned = await this.assignments.assignedMemberIds(actor.userId);
      if (query.memberId) {
        if (assigned.includes(query.memberId)) {
          qb.andWhere('f.memberId = :memberId', { memberId: query.memberId });
        } else if (await this.feedback.exists({ where: { trainerId: actor.userId, memberId: query.memberId } })) {
          // Former member: only the trainer's own history.
          qb.andWhere('f.memberId = :memberId AND f.trainerId = :self', { memberId: query.memberId, self: actor.userId });
        } else {
          throw forbidden('Not authorized to view feedback for this member.');
        }
      } else {
        qb.andWhere(
          new Brackets((w) => {
            w.where('f.trainerId = :self', { self: actor.userId });
            if (assigned.length) w.orWhere('f.memberId IN (:...assigned)', { assigned });
          }),
        );
      }
    } else {
      throw forbidden('Administrators see aggregate feedback statistics only.');
    }
    if (query.unread !== undefined) qb.andWhere(query.unread ? 'f.readAt IS NULL' : 'f.readAt IS NOT NULL');
    if (query.relatedGoalId) qb.andWhere('f.relatedGoalId = :goalId', { goalId: query.relatedGoalId });
    if (query.relatedPlanId) qb.andWhere('f.relatedPlanId = :planId', { planId: query.relatedPlanId });

    const [rows, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    const unread = actor.role === Role.Member ? await this.feedback.count({ where: { memberId: actor.userId, readAt: IsNull() } }) : null;
    return { items: rows.map((f) => this.toView(f)), total, page: query.page, limit: query.limit, unread };
  }

  async findOne(id: number, actor: AuthUser) {
    const item = await this.getById(id);
    await this.assertCanRead(item, actor);
    return this.toView(item);
  }

  /** Author only, while still assigned. A changed message is shown as new (unread) again. */
  async update(id: number, dto: UpdateTrainerFeedbackDto, actor: AuthUser) {
    const item = await this.getById(id);
    await this.assertCanManage(item, actor);
    const goalId = dto.relatedGoalId !== undefined ? dto.relatedGoalId : item.relatedGoalId;
    const planId = dto.relatedPlanId !== undefined ? dto.relatedPlanId : item.relatedPlanId;
    await this.validateRelations(item.memberId, goalId, planId, actor);
    const message = dto.feedbackMessage !== undefined ? this.cleanMessage(dto.feedbackMessage) : item.feedbackMessage;
    const messageChanged = message !== item.feedbackMessage;
    await this.feedback.update(
      { feedbackId: id },
      {
        feedbackMessage: message,
        feedbackType: dto.feedbackType ?? item.feedbackType,
        updatedAt: new Date(),
        relatedGoalId: goalId,
        relatedPlanId: planId,
        ...(messageChanged && { readAt: null }),
      },
    );
    return this.toView(await this.getById(id));
  }

  async remove(id: number, actor: AuthUser): Promise<void> {
    const item = await this.getById(id);
    await this.assertCanManage(item, actor);
    await this.feedback.delete({ feedbackId: id });
  }

  /** The recipient marks feedback as read (idempotent: the first ReadAt is kept). */
  async markRead(id: number, actor: AuthUser) {
    const item = await this.getById(id);
    if (item.memberId !== actor.userId) throw forbidden('You can only mark your own feedback as read.');
    // UpdatedAt is passed unchanged so a read receipt never counts as an edit
    // (otherwise TypeORM / ON UPDATE CURRENT_TIMESTAMP would bump it).
    if (!item.readAt) await this.feedback.update({ feedbackId: id }, { readAt: new Date(), updatedAt: item.updatedAt });
    return this.toView(await this.getById(id));
  }

  // ================================================================ dashboards / reports

  /** Recent feedback visible to a member or trainer (dashboards). */
  async recent(actor: AuthUser, take = 5) {
    const page = await this.findAll(Object.assign(new TrainerFeedbackQueryDto(), { page: 1, limit: take }), actor);
    return { items: page.items, unread: page.unread };
  }

  /** Counts per member written by a trainer (trainer dashboard/report). */
  async countsForTrainer(trainerId: number, from?: Date, to?: Date) {
    const qb = this.feedback
      .createQueryBuilder('f')
      .select('f.memberId', 'memberId')
      .addSelect('COUNT(*)', 'sent')
      .addSelect('SUM(CASE WHEN f.readAt IS NULL THEN 1 ELSE 0 END)', 'unread')
      .addSelect('MAX(f.createdAt)', 'lastSentAt')
      .where('f.trainerId = :trainerId', { trainerId })
      .groupBy('f.memberId');
    if (from) qb.andWhere('f.createdAt >= :from', { from });
    if (to) qb.andWhere('f.createdAt <= :to', { to });
    const rows = await qb.getRawMany<{ memberId: number; sent: string; unread: string; lastSentAt: Date }>();
    return rows.map((r) => ({ memberId: Number(r.memberId), sent: Number(r.sent), unread: Number(r.unread), lastSentAt: r.lastSentAt }));
  }

  /** Aggregate statistics with no message content and no names (admin). */
  async statistics(range?: { from: Date; to: Date }) {
    const qb = this.feedback.createQueryBuilder('f');
    if (range) qb.where('f.createdAt BETWEEN :from AND :to', range);
    const [totals, byType] = await Promise.all([
      qb
        .clone()
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN f.readAt IS NOT NULL THEN 1 ELSE 0 END)', 'read')
        .addSelect('COUNT(DISTINCT f.trainerId)', 'trainers')
        .addSelect('COUNT(DISTINCT f.memberId)', 'members')
        .addSelect('SUM(CASE WHEN f.relatedGoalId IS NOT NULL THEN 1 ELSE 0 END)', 'aboutGoals')
        .addSelect('SUM(CASE WHEN f.relatedPlanId IS NOT NULL THEN 1 ELSE 0 END)', 'aboutPlans')
        .getRawOne<Record<string, string>>(),
      qb.clone().select('f.feedbackType', 'feedbackType').addSelect('COUNT(*)', 'count').groupBy('f.feedbackType').getRawMany<{ feedbackType: string; count: string }>(),
    ]);
    const total = Number(totals?.total ?? 0);
    const read = Number(totals?.read ?? 0);
    return {
      total,
      read,
      unread: total - read,
      readRatePercent: total ? Math.round((read / total) * 1000) / 10 : null,
      trainersGivingFeedback: Number(totals?.trainers ?? 0),
      membersReceivingFeedback: Number(totals?.members ?? 0),
      aboutGoals: Number(totals?.aboutGoals ?? 0),
      aboutPlans: Number(totals?.aboutPlans ?? 0),
      byType: FEEDBACK_TYPES.map((feedbackType) => ({ feedbackType, count: Number(byType.find((t) => t.feedbackType === feedbackType)?.count ?? 0) })),
    };
  }

  /** Feedback a member received in a period, plus currently unread (member report; counts only). */
  countForMember(memberId: number, from: Date, to: Date) {
    return Promise.all([
      this.feedback.count({ where: { memberId, createdAt: Between(from, to) } }),
      this.feedback.count({ where: { memberId, readAt: IsNull() } }),
    ]).then(([received, unread]) => ({ received, unread }));
  }

  // ================================================================ helpers

  private baseQuery() {
    return this.feedback
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.trainer', 'trainer')
      .leftJoinAndSelect('f.member', 'member')
      .leftJoinAndSelect('f.relatedGoal', 'goal')
      .leftJoinAndSelect('f.relatedPlan', 'plan');
  }

  private async getById(id: number): Promise<TrainerFeedback> {
    const item = await this.baseQuery().where('f.feedbackId = :id', { id }).getOne();
    if (!item) throw notFound('Feedback not found.', 'Feedback ID does not exist.');
    return item;
  }

  private async assertCanRead(item: TrainerFeedback, actor: AuthUser): Promise<void> {
    if (actor.role === Role.Member && item.memberId === actor.userId) return;
    if (actor.role === Role.Trainer) {
      if (item.trainerId === actor.userId) return;
      if (await this.assignments.isAssigned(actor.userId, item.memberId)) return;
    }
    throw forbidden('Not authorized to view this feedback.');
  }

  private async assertCanManage(item: TrainerFeedback, actor: AuthUser): Promise<void> {
    if (item.trainerId !== actor.userId) throw forbidden('You can only change feedback you wrote.');
    if (!(await this.assignments.isAssigned(actor.userId, item.memberId))) {
      throw forbidden('You are no longer assigned to this member; past feedback is kept as history.');
    }
  }

  private cleanMessage(raw: string): string {
    const message = normalizeFeedbackMessage(raw);
    if (message.length < FEEDBACK_MIN_LENGTH) {
      throw badRequest('Invalid input data.', `Feedback message must contain at least ${FEEDBACK_MIN_LENGTH} characters of text.`);
    }
    if (message.length > FEEDBACK_MAX_LENGTH) {
      throw badRequest('Invalid input data.', `Feedback message cannot exceed ${FEEDBACK_MAX_LENGTH} characters.`);
    }
    return message;
  }

  /** At most one related item; it must belong to the member (and a plan to this trainer). */
  private async validateRelations(memberId: number, goalId: number | null, planId: number | null, actor: AuthUser): Promise<void> {
    if (goalId !== null && planId !== null) {
      throw badRequest('Invalid feedback data.', 'Feedback can refer to a goal or a workout plan, not both.');
    }
    if (goalId !== null) await this.goals.getForMember(goalId, memberId);
    if (planId !== null) {
      const plan = await this.plans.findOne({ where: { planId } });
      if (!plan) throw notFound('Workout plan not found.', 'Plan ID does not exist.');
      if (plan.memberId !== memberId) throw badRequest('Invalid feedback data.', 'The workout plan does not belong to this member.');
      if (plan.trainerId !== actor.userId) throw badRequest('Invalid feedback data.', 'You can only refer to workout plans you created.');
    }
  }

  toView(f: TrainerFeedback) {
    const edited = new Date(f.updatedAt).getTime() - new Date(f.createdAt).getTime() > 1000;
    return {
      feedbackId: f.feedbackId,
      trainerId: f.trainerId,
      memberId: f.memberId,
      trainer: f.trainer ? { userId: f.trainer.userId, fullName: f.trainer.fullName } : null,
      member: f.member ? { userId: f.member.userId, fullName: f.member.fullName } : null,
      feedbackType: f.feedbackType,
      feedbackMessage: f.feedbackMessage,
      relatedGoalId: f.relatedGoalId,
      relatedPlanId: f.relatedPlanId,
      relatedGoal: f.relatedGoal ? { goalId: f.relatedGoal.goalId, goalName: f.relatedGoal.goalName, goalType: f.relatedGoal.goalType } : null,
      relatedPlan: f.relatedPlan ? { planId: f.relatedPlan.planId, planName: f.relatedPlan.planName } : null,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      edited,
      readAt: f.readAt,
      isRead: f.readAt !== null,
    };
  }
}
