import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PlanExercise } from '../../plan-exercises/entities/plan-exercise.entity';
import { WorkoutLog } from '../../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../../workout-plans/entities/workout-plan.entity';

/**
 * WorkoutCompletions table (Version 2.0, migration 002).
 *
 * Counts ONE workout log toward ONE prescribed plan exercise. Completion
 * status is not stored: it is derived from the linked log's actual sets and
 * repetitions versus the prescription copied into this row, so editing the
 * log recalculates it and deleting the log (ON DELETE CASCADE) removes it.
 * PlanExerciseID / PlanID become NULL when the trainer removes the exercise
 * or deletes the plan; the snapshot columns keep the history meaningful.
 */
@Entity({ name: 'WorkoutCompletions' })
@Unique('UQ_WorkoutCompletions_Log', ['logId'])
@Index('IX_WorkoutCompletions_PlanExercise', ['planExerciseId'])
@Index('IX_WorkoutCompletions_Plan', ['planId'])
@Check('CHK_WorkoutCompletions_PrescribedSets', '`PrescribedSets` > 0')
@Check('CHK_WorkoutCompletions_PrescribedReps', '`PrescribedReps` > 0')
@Check('CHK_WorkoutCompletions_PrescribedDuration', '`PrescribedDurationMinutes` IS NULL OR `PrescribedDurationMinutes` > 0')
export class WorkoutCompletion {
  @PrimaryGeneratedColumn({ name: 'CompletionID', type: 'int' })
  completionId: number;

  @Column({ name: 'LogID', type: 'int' })
  logId: number;

  @Column({ name: 'PlanExerciseID', type: 'int', nullable: true })
  planExerciseId: number | null;

  @Column({ name: 'PlanID', type: 'int', nullable: true })
  planId: number | null;

  @Column({ name: 'PlanNameSnapshot', type: 'varchar', length: 100 })
  planName: string;

  @Column({ name: 'PrescribedSets', type: 'int' })
  prescribedSets: number;

  @Column({ name: 'PrescribedReps', type: 'int' })
  prescribedReps: number;

  /** Migration 003: snapshot of TargetDurationMinutes (NULL = repetition-based). */
  @Column({ name: 'PrescribedDurationMinutes', type: 'int', nullable: true })
  prescribedDurationMinutes: number | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  @OneToOne(() => WorkoutLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'LogID', foreignKeyConstraintName: 'FK_WorkoutCompletions_Log' })
  log?: WorkoutLog;

  @ManyToOne(() => PlanExercise, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'PlanExerciseID', foreignKeyConstraintName: 'FK_WorkoutCompletions_PlanExercise' })
  planExercise?: PlanExercise | null;

  @ManyToOne(() => WorkoutPlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'PlanID', foreignKeyConstraintName: 'FK_WorkoutCompletions_Plan' })
  plan?: WorkoutPlan | null;
}
