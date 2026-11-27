import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../common/enums';

/**
 * Users table (Lab 04). TypeScript/JSON use camelCase, the database keeps the
 * documented PascalCase column names via the `name` option.
 */
@Entity({ name: 'Users' })
@Check('CHK_Users_Role', "`Role` IN ('Member', 'Trainer', 'Admin')")
export class User {
  @PrimaryGeneratedColumn({ name: 'UserID', type: 'int' })
  userId: number;

  @Column({ name: 'FullName', type: 'varchar', length: 100 })
  fullName: string;

  @Index('UQ_Users_Email', { unique: true })
  @Column({ name: 'Email', type: 'varchar', length: 100 })
  email: string;

  @Column({ name: 'Role', type: 'varchar', length: 10 })
  role: Role;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  /**
   * bcrypt hash. `select: false` keeps it out of every query unless it is
   * explicitly requested (login), and @Exclude removes it from JSON output.
   */
  @Exclude()
  @Column({ name: 'PasswordHash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  /** Lab 05 exposes the ProfileImage column as `profileImg`. */
  @Column({ name: 'ProfileImage', type: 'varchar', length: 255, nullable: true })
  profileImg: string | null;

  @Column({ name: 'IsActive', type: 'boolean', default: true })
  isActive: boolean;
}
