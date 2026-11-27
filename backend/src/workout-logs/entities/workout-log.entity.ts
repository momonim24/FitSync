import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { User } from '../../users/entities/user.entity';

/** WorkoutLogs table (Lab 04): a workout a member performed. */
@Entity({ name: 'WorkoutLogs' })
@Index('IX_WorkoutLogs_Member_Date', ['memberId', 'workoutDate'])
@Check('CHK_WorkoutLogs_Sets', '`Sets` > 0')
@Check('CHK_WorkoutLogs_Repetitions', '`Repetitions` >= 0')
@Check('CHK_WorkoutLogs_Duration', '`DurationMinutes` >= 0')
export class WorkoutLog {
  @PrimaryGeneratedColumn({ name: 'LogID', type: 'int' })
  logId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @Column({ name: 'ExerciseID', type: 'int' })
  exerciseId: number;

  /** DATE column, returned as a 'YYYY-MM-DD' string (see dateStrings in database.config.ts). */
  @Column({ name: 'WorkoutDate', type: 'date' })
  workoutDate: string;

  @Column({ name: 'Sets', type: 'int' })
  sets: number;

  @Column({ name: 'Repetitions', type: 'int' })
  repetitions: number;

  @Column({ name: 'DurationMinutes', type: 'int' })
  durationMinutes: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_WorkoutLogs_Member' })
  member?: User;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ExerciseID', foreignKeyConstraintName: 'FK_WorkoutLogs_Exercise' })
  exercise?: Exercise;
}
