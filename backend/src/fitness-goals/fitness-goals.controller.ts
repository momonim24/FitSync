import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateFitnessGoalDto, FitnessGoalQueryDto, UpdateFitnessGoalDto } from './dto/fitness-goal.dto';
import { FitnessGoalsService } from './fitness-goals.service';

/**
 * /api/v1/fitness-goals — Version 2.0 fitness goal management.
 * Members own their goals; trainers read the goals of assigned members;
 * administrators get aggregate statistics only (admin dashboard / report).
 */
@Controller('fitness-goals')
export class FitnessGoalsController {
  constructor(private readonly service: FitnessGoalsService) {}

  /** Create a goal (Member). */
  @Roles(Role.Member)
  @Post()
  create(@Body() dto: CreateFitnessGoalDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  /** Goals with calculated progress (?memberId, ?status, ?goalType, ?page, ?limit). */
  @Roles(Role.Member, Role.Trainer)
  @Get()
  async findAll(@Query() query: FitnessGoalQueryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  /** One goal with its weekly breakdown. */
  @Roles(Role.Member, Role.Trainer)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  /** Update or cancel ({ "status": "Cancelled" }) an active goal (Member, own). */
  @Roles(Role.Member)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFitnessGoalDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }
}
