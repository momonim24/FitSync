import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { Exercise } from '../exercises/entities/exercise.entity';
import { TrainerAssignmentsService } from '../trainer-assignments/trainer-assignments.service';
import { WorkoutCompletionsService } from '../workout-completions/workout-completions.service';
import { CreateWorkoutLogDto, UpdateWorkoutLogDto, WorkoutLogQueryDto } from './dto/workout-log.dto';
import { WorkoutLog } from './entities/workout-log.entity';

const VIEW_DENIED = 'Not authorized to view these workouts.';

@Injectable()
export class WorkoutLogsService {
  constructor(
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
    private readonly assignments: TrainerAssignmentsService,
    private readonly completions: WorkoutCompletionsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lab 05 #9 — a member records their own workout.
   * Version 2.0: with planExerciseId the workout is also counted toward that
   * prescribed plan exercise (same transaction), and the response gains a
   * `completion` object. Without it the behaviour and response are unchanged.
   */
  async create(dto: CreateWorkoutLogDto, actor: AuthUser): Promise<WorkoutLog | (WorkoutLog & { completion: unknown })> {
    if (dto.memberId !== undefined && dto.memberId !== actor.userId) {
      throw forbidden('Members can only record their own workouts.');
    }
    await this.assertExerciseExists(dto.exerciseId);
    const { planExerciseId, ...fields } = dto;
    if (planExerciseId === undefined) {
      const saved = await this.logs.save(this.logs.create({ ...fields, memberId: actor.userId }));
      return this.getById(saved.logId);
    }

    const target = await this.completions.loadLinkTarget(planExerciseId, dto.exerciseId, dto.workoutDate, actor);
    const logId = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(WorkoutLog).save(this.logs.create({ ...fields, memberId: actor.userId }));
      await this.completions.saveLink(manager, this.completions.buildLink(saved.logId, target));
      return saved.logId;
    });
    return Object.assign(await this.getById(logId), { completion: await this.completions.findByLog(logId) });
  }

  /** Lab 05 #10 — workout history, scoped to what the actor may see. */
  async findAll(query: WorkoutLogQueryDto, actor: AuthUser): Promise<Paginated<WorkoutLog>> {
    const memberIds = await this.assignments.resolveMemberScope(actor, query.memberId, VIEW_DENIED);
    const qb = this.logs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.exercise', 'exercise')
      .leftJoinAndSelect('log.member', 'member')
      .orderBy('log.workoutDate', 'DESC')
      .addOrderBy('log.logId', 'DESC');

    if (memberIds !== null) {
      if (memberIds.length === 0) return { items: [], total: 0, page: query.page, limit: query.limit };
      qb.andWhere('log.memberId IN (:...memberIds)', { memberIds });
    }
    if (query.exerciseId) qb.andWhere('log.exerciseId = :exerciseId', { exerciseId: query.exerciseId });
    if (query.from) qb.andWhere('log.workoutDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.workoutDate <= :to', { to: query.to });

    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number, actor: AuthUser): Promise<WorkoutLog> {
    const log = await this.getById(id);
    await this.assignments.assertCanViewMember(actor, log.memberId, 'Not authorized to view this workout.');
    return log;
  }

  /** Only the member who recorded the workout may edit it. */
  async update(id: number, dto: UpdateWorkoutLogDto, actor: AuthUser): Promise<WorkoutLog> {
    const log = await this.getById(id);
    if (log.memberId !== actor.userId) throw forbidden('You can only update your own workouts.');
    if (dto.exerciseId !== undefined) await this.assertExerciseExists(dto.exerciseId);
    await this.logs.update({ logId: id }, dto);
    const updated = await this.getById(id);
    // Version 2.0: completion is recalculated from the edited log on every
    // read; a log that no longer matches its prescription stops counting.
    await this.completions.reconcileAfterLogUpdate(updated);
    return updated;
  }

  /** The owner (or an admin, for moderation) may delete a workout. */
  async remove(id: number, actor: AuthUser): Promise<void> {
    const log = await this.getById(id);
    if (actor.role !== Role.Admin && log.memberId !== actor.userId) {
      throw forbidden('You can only delete your own workouts.');
    }
    await this.logs.delete({ logId: id });
  }

  private async getById(id: number): Promise<WorkoutLog> {
    const log = await this.logs.findOne({ where: { logId: id }, relations: { exercise: true, member: true } });
    if (!log) throw notFound('Workout log not found.', 'Log ID does not exist.');
    return log;
  }

  private async assertExerciseExists(exerciseId: number): Promise<void> {
    if (!(await this.exercises.exists({ where: { exerciseId } }))) {
      throw notFound('Exercise not found.', 'Exercise ID does not exist.');
    }
  }
}
