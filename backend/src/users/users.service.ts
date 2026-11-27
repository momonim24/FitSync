import { containsPattern } from '../common/utils/like.util';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, Repository } from 'typeorm';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { badRequest, conflict, forbidden, notFound } from '../common/utils/http-errors';
import { Paginated } from '../common/utils/pagination.util';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { CreateAccountDto, RegisterUserDto, UpdateRoleDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { User } from './entities/user.entity';

/**
 * Business logic for user accounts. The controller only routes requests;
 * every rule (uniqueness, ownership, admin safety checks) lives here.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TrainerAssignment) private readonly assignments: Repository<TrainerAssignment>,
    private readonly config: ConfigService,
  ) {}

  /** Public registration and admin account creation share this method. */
  async create(dto: RegisterUserDto, role: Role = Role.Member): Promise<User> {
    await this.assertEmailAvailable(dto.email);
    const rounds = Number(this.config.get('BCRYPT_SALT_ROUNDS', 10));
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const saved = await this.users.save(
      this.users.create({
        fullName: dto.fullName,
        email: dto.email,
        role,
        passwordHash,
        profileImg: null,
        isActive: true,
      }),
    );
    return this.getById(saved.userId);
  }

  createAccount(dto: CreateAccountDto): Promise<User> {
    return this.create(dto, dto.role);
  }

  async findAll(query: UserQueryDto): Promise<Paginated<User>> {
    const qb = this.users.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.isActive) qb.andWhere('user.isActive = :isActive', { isActive: query.isActive === 'true' });
    if (query.search) {
      qb.andWhere(
        new Brackets((w) =>
          w.where('user.fullName LIKE :search', { search: containsPattern(query.search ?? '') })
            .orWhere('user.email LIKE :search', { search: containsPattern(query.search ?? '') }),
        ),
      );
    }
    const [items, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Owner or Admin only (Lab 05 endpoint 2). */
  async findOne(id: number, actor: AuthUser): Promise<User> {
    this.assertOwnerOrAdmin(id, actor, 'Cannot view another user profile.');
    return this.getById(id);
  }

  /** Owner or Admin only (Lab 05 endpoint 3). */
  async update(id: number, dto: UpdateUserDto, actor: AuthUser): Promise<User> {
    this.assertOwnerOrAdmin(id, actor, 'Cannot update another user profile.');
    const user = await this.getById(id);

    if (dto.email && dto.email !== user.email) {
      await this.assertEmailAvailable(dto.email);
      user.email = dto.email;
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.profileImg !== undefined) user.profileImg = dto.profileImg || null;

    await this.users.save(user);
    return this.getById(id);
  }

  /** Soft delete: IsActive becomes false (Lab 05 endpoint 4). */
  async deactivate(id: number, actor: AuthUser): Promise<void> {
    this.assertOwnerOrAdmin(id, actor, 'Cannot deactivate another user account.');
    const user = await this.getById(id);
    if (!user.isActive) return;
    if (user.role === Role.Admin) await this.assertAnotherActiveAdmin(user.userId);
    user.isActive = false;
    await this.users.save(user);
  }

  async activate(id: number): Promise<User> {
    const user = await this.getById(id);
    user.isActive = true;
    await this.users.save(user);
    return user;
  }

  async changeRole(id: number, dto: UpdateRoleDto, actor: AuthUser): Promise<User> {
    const user = await this.getById(id);
    if (user.role === dto.role) return user;
    if (user.userId === actor.userId) {
      throw badRequest('Invalid role change.', 'You cannot change your own role.');
    }
    const linked = await this.assignments.count({
      where: [{ trainerId: id }, { memberId: id }],
    });
    if (linked > 0) {
      throw conflict(
        'Role change blocked.',
        'Remove this user\'s trainer assignments before changing their role.',
      );
    }
    user.role = dto.role;
    await this.users.save(user);
    return user;
  }

  /** Throws 404 in the Lab 05 format if the user does not exist. */
  async getById(id: number): Promise<User> {
    const user = await this.users.findOne({ where: { userId: id } });
    if (!user) throw notFound('User not found.', 'User ID does not exist.');
    return user;
  }

  /** Used only by AuthService: includes the normally hidden password hash. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findByIdWithPassword(id: number): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.userId = :id', { id })
      .getOne();
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await this.users.update({ userId: id }, { passwordHash });
  }

  private assertOwnerOrAdmin(id: number, actor: AuthUser, reason: string): void {
    if (actor.role !== Role.Admin && actor.userId !== id) throw forbidden(reason);
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    if (await this.users.exists({ where: { email } })) {
      throw conflict('Email already registered.', 'Email must be unique.');
    }
  }

  private async assertAnotherActiveAdmin(excludeId: number): Promise<void> {
    const others = await this.users
      .createQueryBuilder('user')
      .where('user.role = :role', { role: Role.Admin })
      .andWhere('user.isActive = true')
      .andWhere('user.userId <> :id', { id: excludeId })
      .getCount();
    if (others === 0) {
      throw conflict('Deactivation blocked.', 'At least one active admin account is required.');
    }
  }
}
