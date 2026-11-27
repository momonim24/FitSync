import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { FitnessGoal } from '../../fitness-goals/entities/fitness-goal.entity';
import { User } from '../../users/entities/user.entity';
import { WorkoutPlan } from '../../workout-plans/entities/workout-plan.entity';

export const FEEDBACK_TYPES = ['General', 'Encouragement', 'Guidance', 'Concern'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/**
 * TrainerFeedback table (Version 2.0, migration 002): a trainer's note to an
 * assigned member, optionally about one goal or one workout plan.
 */
@Entity({ name: 'TrainerFeedback' })
@Index('IX_TrainerFeedback_Member_Created', ['memberId', 'createdAt'])
@Index('IX_TrainerFeedback_Trainer_Created', ['trainerId', 'createdAt'])
@Index('IX_TrainerFeedback_Goal', ['relatedGoalId'])
@Index('IX_TrainerFeedback_Plan', ['relatedPlanId'])
@Check('CHK_TrainerFeedback_Type', "`FeedbackType` IN ('General', 'Encouragement', 'Guidance', 'Concern')")
@Check('CHK_TrainerFeedback_Message', 'CHAR_LENGTH(`FeedbackMessage`) >= 2')
export class TrainerFeedback {
  @PrimaryGeneratedColumn({ name: 'FeedbackID', type: 'int' })
  feedbackId: number;

  @Column({ name: 'TrainerID', type: 'int' })
  trainerId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @Column({ name: 'RelatedGoalID', type: 'int', nullable: true })
  relatedGoalId: number | null;

  @Column({ name: 'RelatedPlanID', type: 'int', nullable: true })
  relatedPlanId: number | null;

  @Column({ name: 'FeedbackType', type: 'varchar', length: 15 })
  feedbackType: FeedbackType;

  @Column({ name: 'FeedbackMessage', type: 'varchar', length: 1000 })
  feedbackMessage: string;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime' })
  updatedAt: Date;

  @Column({ name: 'ReadAt', type: 'datetime', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'TrainerID', foreignKeyConstraintName: 'FK_TrainerFeedback_Trainer' })
  trainer?: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_TrainerFeedback_Member' })
  member?: User;

  @ManyToOne(() => FitnessGoal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'RelatedGoalID', foreignKeyConstraintName: 'FK_TrainerFeedback_Goal' })
  relatedGoal?: FitnessGoal | null;

  @ManyToOne(() => WorkoutPlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'RelatedPlanID', foreignKeyConstraintName: 'FK_TrainerFeedback_Plan' })
  relatedPlan?: WorkoutPlan | null;
}
