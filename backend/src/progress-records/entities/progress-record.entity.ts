import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { User } from '../../users/entities/user.entity';

/** ProgressRecords table (Lab 04): weight and notes recorded by a member. */
@Entity({ name: 'ProgressRecords' })
@Index('IX_ProgressRecords_Member_Date', ['memberId', 'recordDate'])
@Check('CHK_ProgressRecords_Weight', '`WeightKg` IS NULL OR `WeightKg` > 0')
export class ProgressRecord {
  @PrimaryGeneratedColumn({ name: 'ProgressID', type: 'int' })
  progressId: number;

  @Column({ name: 'MemberID', type: 'int' })
  memberId: number;

  @Column({ name: 'RecordDate', type: 'date' })
  recordDate: string;

  @Column({
    name: 'WeightKg',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  weightKg: number | null;

  @Column({ name: 'Notes', type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'MemberID', foreignKeyConstraintName: 'FK_ProgressRecords_Member' })
  member?: User;
}
