import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { WorkoutPlan } from '../../workout-plans/entities/workout-plan.entity';

/** PlanExercises table (Lab 04): resolves the many-to-many between plans and exercises. */
@Entity({ name: 'PlanExercises' })
@Check('CHK_PlanExercises_TargetSets', '`TargetSets` > 0')
@Check('CHK_PlanExercises_TargetReps', '`TargetReps` > 0')
@Check('CHK_PlanExercises_TargetDuration', '`TargetDurationMinutes` IS NULL OR `TargetDurationMinutes` > 0')
export class PlanExercise {
  @PrimaryGeneratedColumn({ name: 'PlanExerciseID', type: 'int' })
  planExerciseId: number;

  @Column({ name: 'PlanID', type: 'int' })
  planId: number;

  @Column({ name: 'ExerciseID', type: 'int' })
  exerciseId: number;

  @Column({ name: 'TargetSets', type: 'int' })
  targetSets: number;

  @Column({ name: 'TargetReps', type: 'int' })
  targetReps: number;

  /**
   * Extension (migration 003): total minutes for a TIMED exercise. NULL for
   * repetition-based exercises (all Lab 04 rows). When set, completion uses
   * sets + minutes and ignores repetitions (see completion-calculator.ts).
   */
  @Column({ name: 'TargetDurationMinutes', type: 'int', nullable: true })
  targetDurationMinutes: number | null;

  @ManyToOne(() => WorkoutPlan, (plan) => plan.planExercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'PlanID', foreignKeyConstraintName: 'FK_PlanExercises_Plan' })
  plan?: WorkoutPlan;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ExerciseID', foreignKeyConstraintName: 'FK_PlanExercises_Exercise' })
  exercise?: Exercise;
}
