import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { conflict, notFound } from '../common/utils/http-errors';
import { Exercise } from '../exercises/entities/exercise.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { WorkoutPlansService } from '../workout-plans/workout-plans.service';
import { CreatePlanExerciseDto, UpdatePlanExerciseDto } from './dto/plan-exercise.dto';
import { PlanExercise } from './entities/plan-exercise.entity';

@Injectable()
export class PlanExercisesService {
  constructor(
    @InjectRepository(PlanExercise) private readonly planExercises: Repository<PlanExercise>,
    @InjectRepository(WorkoutPlan) private readonly plans: Repository<WorkoutPlan>,
    @InjectRepository(Exercise) private readonly exercises: Repository<Exercise>,
    private readonly plansService: WorkoutPlansService,
  ) {}

  /** Lab 05 #14 — add an exercise with targets to a plan (plan's trainer only). */
  async create(dto: CreatePlanExerciseDto, actor: AuthUser): Promise<PlanExercise> {
    const [plan, exercise] = await Promise.all([
      this.plans.findOne({ where: { planId: dto.planId } }),
      this.exercises.findOne({ where: { exerciseId: dto.exerciseId } }),
    ]);
    if (!plan || !exercise) {
      throw notFound('Resource not found.', 'Workout plan or exercise does not exist.');
    }
    await this.plansService.assertCanManage(plan, actor);

    const duplicate = await this.planExercises.exists({
      where: { planId: dto.planId, exerciseId: dto.exerciseId },
    });
    if (duplicate) {
      throw conflict('Exercise already in plan.', 'This exercise is already part of the workout plan.');
    }
    const saved = await this.planExercises.save(
      this.planExercises.create({
        ...dto,
        // Timed exercises: repetitions are not used; Lab 04 still requires TargetReps > 0.
        targetReps: dto.targetReps ?? 1,
        targetDurationMinutes: dto.targetDurationMinutes ?? null,
      }),
    );
    return this.getById(saved.planExerciseId);
  }

  async findOne(id: number, actor: AuthUser): Promise<PlanExercise> {
    const item = await this.getById(id);
    await this.plansService.assertCanView(item.plan!, actor);
    return item;
  }

  async update(id: number, dto: UpdatePlanExerciseDto, actor: AuthUser): Promise<PlanExercise> {
    const item = await this.getById(id);
    await this.plansService.assertCanManage(item.plan!, actor);
    await this.planExercises.update(
      { planExerciseId: id },
      {
        ...(dto.targetSets !== undefined && { targetSets: dto.targetSets }),
        ...(dto.targetReps !== undefined && { targetReps: dto.targetReps }),
        ...(dto.targetDurationMinutes !== undefined && { targetDurationMinutes: dto.targetDurationMinutes }),
      },
    );
    return this.getById(id);
  }

  async remove(id: number, actor: AuthUser): Promise<void> {
    const item = await this.getById(id);
    if (actor.role !== Role.Admin) await this.plansService.assertCanManage(item.plan!, actor);
    await this.planExercises.delete({ planExerciseId: id });
  }

  private async getById(id: number): Promise<PlanExercise> {
    const item = await this.planExercises.findOne({
      where: { planExerciseId: id },
      relations: { plan: true, exercise: true },
    });
    if (!item) throw notFound('Plan exercise not found.', 'Plan exercise ID does not exist.');
    return item;
  }
}
