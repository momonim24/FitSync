import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** TrainerAssignments table (Lab 04): links a Trainer user to a Member user. */
@Entity({ name: 'TrainerAssignments' })
@Unique('UQ_TrainerAssignments_Pair', ['trainerId', 'memberId'])
export class TrainerAssignment {
  @PrimaryGeneratedColumn({ name: 'AssignmentID', type: 'int' })
  assignmentId: number;

  @Column({ name: 'TrainerID', type: 'int' })
  trainerId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @CreateDateColumn({ name: 'AssignedAt', type: 'datetime' })
  assignedAt: Date;

  /** Many assignments -> one trainer (Users.UserID). */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'TrainerID', foreignKeyConstraintName: 'FK_TrainerAssignments_Trainer' })
  trainer?: User;

  /** Many assignments -> one member (Users.UserID). */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_TrainerAssignments_Member' })
  member?: User;
}
