import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberDateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { badRequest, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { CreateProgressRecordDto, UpdateProgressRecordDto } from './dto/progress-record.dto';
import { ProgressRecord } from './entities/progress-record.entity';

@Injectable()
export class ProgressRecordsService {
  constructor(
    @InjectRepository(ProgressRecord) private readonly records: Repository<ProgressRecord>,
    private readonly assignments: TrainerAssignmentsService,
  ) {}

  /** Lab 05 #11 — a member adds their own progress record. */
  async create(dto: CreateProgressRecordDto, actor: AuthUser): Promise<ProgressRecord> {
    if (dto.memberId !== undefined && dto.memberId !== actor.userId) {
      throw forbidden('Members can only record their own progress.');
    }
    const weightKg = dto.weightKg ?? null;
    const notes = dto.notes || null;
    if (weightKg === null && notes === null) {
      throw badRequest('Invalid progress data.', 'Provide a weight, notes, or both.');
    }
    const saved = await this.records.save(
      this.records.create({ memberId: actor.userId, recordDate: dto.recordDate, weightKg, notes }),
    );
    return this.getById(saved.progressId);
  }

  async findAll(query: MemberDateRangeQueryDto, actor: AuthUser): Promise<Paginated<ProgressRecord>> {
    const memberIds = await this.assignments.resolveMemberScope(
      actor,
      query.memberId,
      'Not authorized to view these progress records.',
    );
    const qb = this.records
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.member', 'member')
      .orderBy('record.recordDate', 'DESC')
      .addOrderBy('record.progressId', 'DESC');

    if (memberIds !== null) {
      if (memberIds.length === 0) return { items: [], total: 0, page: query.page, limit: query.limit };
      qb.andWhere('record.memberId IN (:...memberIds)', { memberIds });
    }
    if (query.from) qb.andWhere('record.recordDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('record.recordDate <= :to', { to: query.to });

    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Lab 05 #12 — View progress record (owner member, assigned trainer, admin). */
  async findOne(id: number, actor: AuthUser): Promise<ProgressRecord> {
    const record = await this.getById(id);
    await this.assignments.assertCanViewMember(actor, record.memberId, 'Not authorized to view this progress record.');
    return record;
  }

  async update(id: number, dto: UpdateProgressRecordDto, actor: AuthUser): Promise<ProgressRecord> {
    const record = await this.getById(id);
    if (record.memberId !== actor.userId) throw forbidden('You can only update your own progress records.');

    const next = {
      recordDate: dto.recordDate ?? record.recordDate,
      weightKg: dto.weightKg !== undefined ? dto.weightKg : record.weightKg,
      notes: dto.notes !== undefined ? dto.notes || null : record.notes,
    };
    if (next.weightKg === null && next.notes === null) {
      throw badRequest('Invalid progress data.', 'Provide a weight, notes, or both.');
    }
    await this.records.update({ progressId: id }, next);
    return this.getById(id);
  }

  async remove(id: number, actor: AuthUser): Promise<void> {
    const record = await this.getById(id);
    if (actor.role !== Role.Admin && record.memberId !== actor.userId) {
      throw forbidden('You can only delete your own progress records.');
    }
    await this.records.delete({ progressId: id });
  }

  private async getById(id: number): Promise<ProgressRecord> {
    const record = await this.records.findOne({ where: { progressId: id }, relations: { member: true } });
    if (!record) throw notFound('Progress record not found.', 'Progress ID does not exist.');
    return record;
  }
}
