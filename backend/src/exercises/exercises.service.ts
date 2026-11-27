import { containsPattern } from '../common/utils/like.util';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { conflict, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { CreateExerciseDto, ExerciseQueryDto } from './dto/exercise.dto';
import { Exercise } from './entities/exercise.entity';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
    @InjectRepository(WorkoutLog) private readonly logs: Repository<WorkoutLog>,
    @InjectRepository(PlanExercise) private readonly planExercises: Repository<PlanExercise>,
  ) {}

  /** Lab 05 #5 — catalog with ?search, ?category and pagination. */
  async findAll(query: ExerciseQueryDto): Promise<Paginated<Exercise>> {
    const qb = this.exercises.createQueryBuilder('e').orderBy('e.exerciseName', 'ASC');
    if (query.category) qb.andWhere('e.category = :category', { category: query.category });
    if (query.search) {
      qb.andWhere(
        new Brackets((w) =>
          w.where('e.exerciseName LIKE :s', { s: containsPattern(query.search ?? '') })
            .orWhere('e.description LIKE :s', { s: containsPattern(query.search ?? '') }),
        ),
      );
    }
    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  async categories(): Promise<string[]> {
    const rows = await this.exercises
      .createQueryBuilder('e')
      .select('DISTINCT e.category', 'category')
      .orderBy('category', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((row) => row.category);
  }

  async findOne(id: number): Promise<Exercise> {
    const exercise = await this.exercises.findOne({ where: { exerciseId: id } });
    if (!exercise) throw notFound('Exercise not found.', 'Exercise ID does not exist.');
    return exercise;
  }

  /** Lab 05 #6 — Admin adds an exercise. */
  async create(dto: CreateExerciseDto): Promise<Exercise> {
    await this.assertNameAvailable(dto.exerciseName);
    return this.exercises.save(
      this.exercises.create({ ...dto, description: dto.description || null }),
    );
  }

  /** Admin replaces an exercise's details (PUT semantics). */
  async replace(id: number, dto: CreateExerciseDto): Promise<Exercise> {
    const exercise = await this.findOne(id);
    await this.assertNameAvailable(dto.exerciseName, id);
    exercise.exerciseName = dto.exerciseName;
    exercise.category = dto.category;
    exercise.description = dto.description || null;
    return this.exercises.save(exercise);
  }

  /** Exercises referenced by logs or plans cannot be deleted (data integrity). */
  async remove(id: number): Promise<void> {
    const exercise = await this.findOne(id);
    const [logCount, planCount] = await Promise.all([
      this.logs.count({ where: { exerciseId: id } }),
      this.planExercises.count({ where: { exerciseId: id } }),
    ]);
    if (logCount > 0 || planCount > 0) {
      throw conflict(
        'Exercise is in use.',
        `This exercise is used by ${logCount} workout log(s) and ${planCount} workout plan item(s) and cannot be deleted.`,
      );
    }
    await this.exercises.remove(exercise);
  }

  private async assertNameAvailable(name: string, exceptId?: number): Promise<void> {
    const existing = await this.exercises
      .createQueryBuilder('e')
      .where('LOWER(e.exerciseName) = LOWER(:name)', { name })
      .getOne();
    if (existing && existing.exerciseId !== exceptId) {
      throw conflict('Exercise already exists.', 'Exercise name must be unique.');
    }
  }
}
