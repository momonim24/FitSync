import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { badRequest, conflict, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';
import { CreateTrainerAssignmentDto, TrainerAssignmentQueryDto } from './dto/trainer-assignment.dto';
import { TrainerAssignment } from './entities/trainer-assignment.entity';

/**
 * Manages trainer-member assignments and provides the shared
 * "is this trainer assigned to this member?" checks used by the
 * workout plan, workout log and progress record services.
 */
@Injectable()
export class TrainerAssignmentsService {
  constructor(
    @InjectRepository(TrainerAssignment) private readonly assignments: Repository<TrainerAssignment>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Lab 05 #13 — Admin assigns a trainer to a member. */
  async create(dto: CreateTrainerAssignmentDto): Promise<TrainerAssignment> {
    await this.validatePair(dto.trainerId, dto.memberId);
    if (await this.isAssigned(dto.trainerId, dto.memberId)) {
      throw conflict('Assignment already exists.', 'Trainer is already assigned to this member.');
    }
    const saved = await this.assignments.save(this.assignments.create(dto));
    return this.getById(saved.assignmentId);
  }

  /** Admin sees all; a trainer sees their members; a member sees their trainers. */
  async findAll(query: TrainerAssignmentQueryDto, actor: AuthUser): Promise<Paginated<TrainerAssignment>> {
    const qb = this.assignments
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.trainer', 'trainer')
      .leftJoinAndSelect('a.member', 'member')
      .orderBy('a.assignedAt', 'DESC');

    if (actor.role === Role.Trainer) qb.andWhere('a.trainerId = :self', { self: actor.userId });
    if (actor.role === Role.Member) qb.andWhere('a.memberId = :self', { self: actor.userId });
    if (query.trainerId) qb.andWhere('a.trainerId = :trainerId', { trainerId: query.trainerId });
    if (query.memberId) qb.andWhere('a.memberId = :memberId', { memberId: query.memberId });

    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number, actor: AuthUser): Promise<TrainerAssignment> {
    const assignment = await this.getById(id);
    const involved = assignment.trainerId === actor.userId || assignment.memberId === actor.userId;
    if (actor.role !== Role.Admin && !involved) {
      throw forbidden('Not authorized to view this assignment.');
    }
    return assignment;
  }

  /** Admin re-assigns (replaces) the trainer/member pair. */
  async update(id: number, dto: CreateTrainerAssignmentDto): Promise<TrainerAssignment> {
    const assignment = await this.getById(id);
    await this.validatePair(dto.trainerId, dto.memberId);
    const duplicate = await this.assignments.findOne({
      where: { trainerId: dto.trainerId, memberId: dto.memberId },
    });
    if (duplicate && duplicate.assignmentId !== id) {
      throw conflict('Assignment already exists.', 'Trainer is already assigned to this member.');
    }
    assignment.trainerId = dto.trainerId;
    assignment.memberId = dto.memberId;
    delete assignment.trainer;
    delete assignment.member;
    await this.assignments.save(assignment);
    return this.getById(id);
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.getById(id);
    await this.assignments.remove(assignment);
  }

  // ---------------------------------------------------------------------
  // Shared access helpers
  // ---------------------------------------------------------------------

  isAssigned(trainerId: number, memberId: number): Promise<boolean> {
    return this.assignments.exists({ where: { trainerId, memberId } });
  }

  async assignedMemberIds(trainerId: number): Promise<number[]> {
    const rows = await this.assignments.find({ where: { trainerId }, select: { memberId: true } });
    return rows.map((row) => row.memberId);
  }

  /**
   * Can `actor` read data that belongs to `memberId`?
   * Member: only themselves. Trainer: only assigned members. Admin: anyone.
   */
  async assertCanViewMember(actor: AuthUser, memberId: number, reason: string): Promise<void> {
    if (actor.role === Role.Admin) return;
    if (actor.role === Role.Member && actor.userId === memberId) return;
    if (actor.role === Role.Trainer && (await this.isAssigned(actor.userId, memberId))) return;
    throw forbidden(reason);
  }

  /**
   * Converts an optional ?memberId filter into the list of member IDs the
   * actor may see. Returns `null` for "no restriction" (admin without filter).
   */
  async resolveMemberScope(actor: AuthUser, memberId: number | undefined, reason: string): Promise<number[] | null> {
    if (actor.role === Role.Admin) return memberId ? [memberId] : null;
    if (actor.role === Role.Member) {
      if (memberId && memberId !== actor.userId) throw forbidden(reason);
      return [actor.userId];
    }
    const assigned = await this.assignedMemberIds(actor.userId);
    if (memberId) {
      if (!assigned.includes(memberId)) throw forbidden(reason);
      return [memberId];
    }
    return assigned;
  }

  private async getById(id: number): Promise<TrainerAssignment> {
    const assignment = await this.assignments.findOne({
      where: { assignmentId: id },
      relations: { trainer: true, member: true },
    });
    if (!assignment) throw notFound('Assignment not found.', 'Assignment ID does not exist.');
    return assignment;
  }

  private async validatePair(trainerId: number, memberId: number): Promise<void> {
    const [trainer, member] = await Promise.all([
      this.users.findOne({ where: { userId: trainerId } }),
      this.users.findOne({ where: { userId: memberId } }),
    ]);
    if (!trainer || !member) {
      throw notFound('Resource not found.', 'Trainer or member does not exist.');
    }
    if (trainer.role !== Role.Trainer || !trainer.isActive) {
      throw badRequest('Invalid assignment data.', 'trainerId must belong to an active Trainer account.');
    }
    if (member.role !== Role.Member || !member.isActive) {
      throw badRequest('Invalid assignment data.', 'memberId must belong to an active Member account.');
    }
  }
}
