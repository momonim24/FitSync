import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import type { GoalStatus, GoalType } from '../goal-progress';

/**
 * FitnessGoals table (Version 2.0, migration 002). Stores the goal
 * definition and its lifecycle status only; progress is calculated from
 * ProgressRecords / WorkoutLogs (see goal-progress.ts).
 */
@Entity({ name: 'FitnessGoals' })
@Index('IX_FitnessGoals_Member_Status', ['memberId', 'status'])
@Check('CHK_FitnessGoals_Type', "`GoalType` IN ('TargetWeight', 'WeeklyWorkouts', 'WeeklyMinutes')")
@Check('CHK_FitnessGoals_Status', "`Status` IN ('Active', 'Completed', 'Missed', 'Cancelled')")
@Check('CHK_FitnessGoals_Target', '`TargetValue` > 0')
@Check('CHK_FitnessGoals_Starting', '`StartingValue` IS NULL OR `StartingValue` > 0')
@Check('CHK_FitnessGoals_WeightStart', "`GoalType` <> 'TargetWeight' OR `StartingValue` IS NOT NULL")
@Check('CHK_FitnessGoals_Dates', '`TargetDate` > `StartDate`')
export class FitnessGoal {
  @PrimaryGeneratedColumn({ name: 'GoalID', type: 'int' })
  goalId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @Column({ name: 'GoalType', type: 'varchar', length: 20 })
  goalType: GoalType;

  @Column({ name: 'GoalName', type: 'varchar', length: 100 })
  goalName: string;

  @Column({ name: 'StartingValue', type: 'decimal', precision: 6, scale: 2, nullable: true, transformer: decimalTransformer })
  startingValue: number | null;

  @Column({ name: 'TargetValue', type: 'decimal', precision: 6, scale: 2, transformer: decimalTransformer })
  targetValue: number;

  @Column({ name: 'StartDate', type: 'date' })
  startDate: string;

  @Column({ name: 'TargetDate', type: 'date' })
  targetDate: string;

  @Column({ name: 'Status', type: 'varchar', length: 10, default: 'Active' })
  status: GoalStatus;

  @Column({ name: 'ClosedAt', type: 'datetime', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_FitnessGoals_Member' })
  member?: User;
}
