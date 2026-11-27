import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PlanExercise } from '../../plan-exercises/entities/plan-exercise.entity';

/** WorkoutPlans table (Lab 04): a plan a trainer creates for an assigned member. */
@Entity({ name: 'WorkoutPlans' })
export class WorkoutPlan {
  @PrimaryGeneratedColumn({ name: 'PlanID', type: 'int' })
  planId: number;

  @Column({ name: 'TrainerID', type: 'int' })
  trainerId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @Column({ name: 'PlanName', type: 'varchar', length: 100 })
  planName: string;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'TrainerID', foreignKeyConstraintName: 'FK_WorkoutPlans_Trainer' })
  trainer?: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_WorkoutPlans_Member' })
  member?: User;

  /** One plan -> many plan exercises (deleted together with the plan). */
  @OneToMany(() => PlanExercise, (planExercise) => planExercise.plan)
  planExercises?: PlanExercise[];
}
