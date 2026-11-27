import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { CreateWorkoutPlanDto, WorkoutPlanQueryDto } from './dto/workout-plan.dto';
import { WorkoutPlan } from './entities/workout-plan.entity';
import { WorkoutPlansService } from './workout-plans.service';

/** /api/v1/workout-plans */
@Controller('workout-plans')
export class WorkoutPlansController {
  constructor(private readonly service: WorkoutPlansService) {}

  /** Lab 05 #7 — Create workout plan (Trainer). */
  @Roles(Role.Trainer)
  @Post()
  create(@Body() dto: CreateWorkoutPlanDto, @CurrentUser() user: AuthUser): Promise<WorkoutPlan> {
    return this.service.create(dto, user);
  }

  /** List plans visible to the current user (?memberId, ?trainerId, ?page, ?limit). */
  @Get()
  async findAll(
    @Query() query: WorkoutPlanQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WorkoutPlan[]> {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<WorkoutPlan> {
    return this.service.findOne(id, user);
  }

  /** Nested resource: exercises inside one plan (Lab 05 URI rule example). */
  @Get(':id/plan-exercises')
  findPlanExercises(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<PlanExercise[]> {
    return this.service.findPlanExercises(id, user);
  }

  /** Lab 05 #8 — Replace workout plan (Trainer). */
  @Roles(Role.Trainer)
  @Put(':id')
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkoutPlanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkoutPlan> {
    return this.service.replace(id, dto, user);
  }

  @Roles(Role.Trainer, Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
