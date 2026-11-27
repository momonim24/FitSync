import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateAccountDto, RegisterUserDto, UpdateRoleDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

/** /api/v1/users — account management (Lab 05 endpoints 1–4 plus admin tools). */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lab 05 #1 — Register user (public, always creates a Member). */
  @Public()
  @Post()
  register(@Body() dto: RegisterUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  /** Admin creates an account with any role (Trainer/Admin bootstrapping). */
  @Roles(Role.Admin)
  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto): Promise<User> {
    return this.usersService.createAccount(dto);
  }

  /** Admin: list users with ?role, ?isActive, ?search, ?page, ?limit. */
  @Roles(Role.Admin)
  @Get()
  async findAll(@Query() query: UserQueryDto, @Res({ passthrough: true }) res: Response): Promise<User[]> {
    return sendPaginated(res, await this.usersService.findAll(query));
  }

  /** Lab 05 #2 — View profile (owner or admin). */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<User> {
    return this.usersService.findOne(id, user);
  }

  /** Lab 05 #3 — Update profile (owner or admin). */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<User> {
    return this.usersService.update(id, dto, user);
  }

  /** Lab 05 #4 — Deactivate account (owner or admin). 204 No Content. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.usersService.deactivate(id, user);
  }

  /** Admin: re-activate a deactivated account. */
  @Roles(Role.Admin)
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.activate(id);
  }

  /** Admin: change a user's role. */
  @Roles(Role.Admin)
  @Patch(':id/role')
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<User> {
    return this.usersService.changeRole(id, dto, user);
  }
}
